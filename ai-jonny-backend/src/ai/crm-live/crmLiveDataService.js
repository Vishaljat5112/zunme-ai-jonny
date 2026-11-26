import mysql from 'mysql2/promise';
import { CrmAuthBridge } from './crmAuthBridge.js';
import { getPool } from '../../db/pool.js';

let crmDbPool = null;

function getCrmDbPool() {
  if (!crmDbPool) {
    crmDbPool = mysql.createPool({
      host: process.env.CRM_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.CRM_DB_PORT || '3306', 10),
      user: process.env.CRM_DB_USER || 'root',
      password: process.env.CRM_DB_PASSWORD || '',
      database: process.env.CRM_DB_NAME || 'crm-db',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });
  }
  return crmDbPool;
}

/**
 * CRM nErgy Live Data Service
 * Dual-tier data engine:
 * 1. HTTP REST API over port 5002 with signed JWT (when CRM server is running)
 * 2. Dedicated secure parameterized SQL queries against crm-db (when CRM server is offline)
 */
export class CrmLiveDataService {
  static CRM_API_URL = process.env.CRM_API_BASE_URL || 'http://127.0.0.1:5002/api';
  static _isHttpOnline = null;
  static _lastHttpCheck = 0;

  static async closePool() {
    if (crmDbPool) {
      await crmDbPool.end();
      crmDbPool = null;
    }
  }

  /**
   * Fast non-blocking check whether CRM HTTP server on port 5002 is active.
   */
  static async checkHttpApiStatus() {
    const now = Date.now();
    if (this._isHttpOnline !== null && now - this._lastHttpCheck < 30000) {
      return this._isHttpOnline;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 800);
      const res = await fetch(`${this.CRM_API_URL}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      this._isHttpOnline = res.ok;
    } catch {
      this._isHttpOnline = false;
    }

    this._lastHttpCheck = now;
    return this._isHttpOnline;
  }

  /**
   * Executes HTTP request to CRM API with JWT session token.
   */
  static async _fetchFromCrmHttp(endpoint, userContext, params = {}) {
    const token = CrmAuthBridge.generateToken(userContext);
    const cleanParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        cleanParams[k] = v;
      }
    }
    const query = new URLSearchParams(cleanParams).toString();
    const url = `${this.CRM_API_URL}${endpoint}${query ? `?${query}` : ''}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`CRM API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.data || data;
  }

  /**
   * 1. getLeadCount: Retrieves accurate count of leads for tenant.
   * Supports: total, today, by status.
   */
  static async getLeadCount(userContext, { filter = 'all', status = null } = {}) {
    const tenantId = userContext.tenantId;

    // Explicitly distinguish Internal Zunme CRM from External CRM
    if (userContext.crmDataSource === 'INTERNAL') {
      const pool = getPool();
      let query = "SELECT COUNT(*) as count FROM crm_contacts WHERE user_id = ? AND type = 'LEAD'";
      const bindings = [userContext.userId];
      if (status && status !== 'all') {
        query += ' AND UPPER(status) = ?';
        bindings.push(status.toUpperCase());
      }
      if (filter === 'today') {
        query += ' AND DATE(created_at) = CURDATE()';
      }
      const [rows] = await pool.query(query, bindings);
      return {
        count: Number(rows[0]?.count || 0),
        filter,
        status: status || 'ALL',
        tenantId,
        dataSource: 'INTERNAL_CRM'
      };
    }

    const isHttp = await this.checkHttpApiStatus();
    if (isHttp) {
      const leads = await this._fetchFromCrmHttp('/leads', userContext, { status: status || undefined });
      const leadList = Array.isArray(leads) ? leads : (leads?.leads || []);
      let count = leadList.length;
      if (filter === 'today') {
        const todayStr = new Date().toISOString().slice(0, 10);
        count = leadList.filter((l) => l.createdAt && l.createdAt.startsWith(todayStr)).length;
      }
      return {
        count,
        filter,
        status: status || 'ALL',
        tenantId
      };
    }

    const pool = getCrmDbPool();

    let query = 'SELECT COUNT(*) as count FROM leads WHERE tenantId = ?';
    const bindings = [tenantId];

    if (status && status !== 'all') {
      query += ' AND UPPER(status) = ?';
      bindings.push(status.toUpperCase());
    }

    if (filter === 'today') {
      query += ' AND DATE(createdAt) = CURDATE()';
    }

    try {
      const [rows] = await pool.query(query, bindings);
      return {
        count: Number(rows[0]?.count || 0),
        filter,
        status: status || 'ALL',
        tenantId
      };
    } catch (dbErr) {
      if (dbErr.code === 'ER_BAD_DB_ERROR' || dbErr.code === 'ER_NO_SUCH_TABLE') {
        return { count: 0, filter, status: status || 'ALL', tenantId };
      }
      throw dbErr;
    }
  }

  /**
   * 2. getMyAssignedLeads: Retrieves leads assigned to caller's userId.
   */
  static async getMyAssignedLeads(userContext, { limit = 10 } = {}) {
    if (userContext.crmDataSource === 'INTERNAL') {
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT id, CONCAT(first_name, ' ', last_name) as name, company, email, phone, status, score, estimated_value as estimatedValue, 'General' as territory, created_at as createdAt 
         FROM crm_contacts 
         WHERE user_id = ? AND type = 'LEAD'
         ORDER BY created_at DESC 
         LIMIT ?`,
        [userContext.userId, Number(limit) || 10]
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name.trim(),
        company: r.company || '',
        email: r.email,
        phone: r.phone || '',
        status: r.status,
        score: Number(r.score || 50),
        estimatedValue: Number(r.estimatedValue || 0),
        territory: r.territory,
        createdAt: r.createdAt,
        dataSource: 'INTERNAL_CRM'
      }));
    }

    const pool = getCrmDbPool();
    const { tenantId, userId } = userContext;

    try {
      const [rows] = await pool.query(
        `SELECT id, name, company, email, phone, status, score, estimatedValue, territory, createdAt 
         FROM leads 
         WHERE tenantId = ? AND assignedUserId = ?
         ORDER BY createdAt DESC 
         LIMIT ?`,
        [tenantId, userId, Number(limit) || 10]
      );

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        company: r.company,
        email: r.email,
        phone: r.phone,
        status: r.status,
        score: r.score,
        estimatedValue: Number(r.estimatedValue || 0),
        territory: r.territory,
        createdAt: r.createdAt
      }));
    } catch (dbErr) {
      if (dbErr.code === 'ER_BAD_DB_ERROR' || dbErr.code === 'ER_NO_SUCH_TABLE') {
        return [];
      }
      throw dbErr;
    }
  }

  /**
   * 3. getLeadDetails: Retrieves single lead by ID or name/company search.
   */
  static async getLeadDetails(userContext, { leadId = null, query = null } = {}) {
    if (userContext.crmDataSource === 'INTERNAL') {
      const pool = getPool();
      let rows;
      if (leadId) {
        [rows] = await pool.query(
          `SELECT * FROM crm_contacts WHERE user_id = ? AND id = ? AND type = 'LEAD'`,
          [userContext.userId, leadId]
        );
      } else if (query) {
        [rows] = await pool.query(
          `SELECT * FROM crm_contacts WHERE user_id = ? AND type = 'LEAD' AND (first_name LIKE ? OR last_name LIKE ? OR company LIKE ? OR email LIKE ?) LIMIT 1`,
          [userContext.userId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
        );
      } else {
        return null;
      }
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        id: r.id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        company: r.company || '',
        email: r.email,
        phone: r.phone || '',
        status: r.status,
        score: Number(r.score || 50),
        estimatedValue: Number(r.estimated_value || 0),
        source: r.source || 'MANUAL',
        territory: 'General',
        assignedUser: { name: userContext.name || 'Owner', email: userContext.email || '' },
        createdAt: r.created_at,
        dataSource: 'INTERNAL_CRM'
      };
    }

    const pool = getCrmDbPool();
    const tenantId = userContext.tenantId;

    let rows;
    try {
      if (leadId) {
        [rows] = await pool.query(
          `SELECT l.*, u.name as assignedUserName, u.email as assignedUserEmail
           FROM leads l
           LEFT JOIN users u ON l.assignedUserId = u.id
           WHERE l.tenantId = ? AND l.id = ?`,
          [tenantId, leadId]
        );
      } else if (query) {
        [rows] = await pool.query(
          `SELECT l.*, u.name as assignedUserName, u.email as assignedUserEmail
           FROM leads l
           LEFT JOIN users u ON l.assignedUserId = u.id
           WHERE l.tenantId = ? AND (l.name LIKE ? OR l.company LIKE ? OR l.email LIKE ?)
           LIMIT 1`,
          [tenantId, `%${query}%`, `%${query}%`, `%${query}%`]
        );
      } else {
        return null;
      }
    } catch (dbErr) {
      if (dbErr.code === 'ER_BAD_DB_ERROR' || dbErr.code === 'ER_NO_SUCH_TABLE') return null;
      throw dbErr;
    }

    if (!rows || rows.length === 0) return null;
    const r = rows[0];

    return {
      id: r.id,
      name: r.name,
      company: r.company,
      email: r.email,
      phone: r.phone,
      status: r.status,
      score: r.score,
      estimatedValue: Number(r.estimatedValue || 0),
      source: r.source,
      territory: r.territory,
      assignedUser: r.assignedUserName ? { name: r.assignedUserName, email: r.assignedUserEmail } : null,
      createdAt: r.createdAt
    };
  }

  /**
   * 4. getDealPipelineSummary: Summary of deals grouped by pipeline stages.
   */
  static async getDealPipelineSummary(userContext) {
    if (userContext.crmDataSource === 'INTERNAL') {
      const pool = getPool();
      const [resRows] = await pool.query(
        `SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as totalValue 
         FROM crm_deals 
         WHERE user_id = ? 
         GROUP BY stage`,
        [userContext.userId]
      );
      const stages = {
        NEW_LEAD: { count: 0, value: 0 },
        CONTACTED: { count: 0, value: 0 },
        QUALIFIED: { count: 0, value: 0 },
        OPPORTUNITY: { count: 0, value: 0 },
        PROPOSAL: { count: 0, value: 0 },
        NEGOTIATION: { count: 0, value: 0 },
        WON: { count: 0, value: 0 },
        LOST: { count: 0, value: 0 }
      };
      let totalPipelineDeals = 0;
      let totalPipelineValue = 0;
      for (const r of resRows) {
        if (stages[r.stage]) {
          stages[r.stage] = { count: Number(r.count), value: Number(r.totalValue) };
        }
        totalPipelineDeals += Number(r.count);
        totalPipelineValue += Number(r.totalValue);
      }
      return {
        stages,
        totalPipelineDeals,
        totalPipelineValue,
        tenantId: userContext.tenantId,
        dataSource: 'INTERNAL_CRM'
      };
    }

    const pool = getCrmDbPool();
    const tenantId = userContext.tenantId;

    let rows = [];
    try {
      const [resRows] = await pool.query(
        `SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as totalValue 
         FROM deals 
         WHERE tenantId = ? 
         GROUP BY stage`,
        [tenantId]
      );
      rows = resRows;
    } catch (dbErr) {
      if (dbErr.code === 'ER_BAD_DB_ERROR' || dbErr.code === 'ER_NO_SUCH_TABLE') rows = [];
      else throw dbErr;
    }

    const stages = {
      NEW_LEAD: { count: 0, value: 0 },
      CONTACTED: { count: 0, value: 0 },
      QUALIFIED: { count: 0, value: 0 },
      OPPORTUNITY: { count: 0, value: 0 },
      PROPOSAL: { count: 0, value: 0 },
      NEGOTIATION: { count: 0, value: 0 },
      WON: { count: 0, value: 0 },
      LOST: { count: 0, value: 0 }
    };

    let totalPipelineDeals = 0;
    let totalPipelineValue = 0;

    for (const r of rows) {
      if (stages[r.stage]) {
        stages[r.stage] = {
          count: Number(r.count),
          value: Number(r.totalValue)
        };
      }
      totalPipelineDeals += Number(r.count);
      totalPipelineValue += Number(r.totalValue);
    }

    return {
      stages,
      totalPipelineDeals,
      totalPipelineValue,
      tenantId
    };
  }

  /**
   * 5. getPipelineValue: Total revenue pipeline value across deals and leads.
   */
  static async getPipelineValue(userContext) {
    if (userContext.crmDataSource === 'INTERNAL') {
      const pool = getPool();
      const [deals] = await pool.query(
        `SELECT COALESCE(SUM(value), 0) as dealValue, COUNT(*) as dealCount FROM crm_deals WHERE user_id = ? AND stage != 'LOST'`,
        [userContext.userId]
      );
      const [leads] = await pool.query(
        `SELECT COALESCE(SUM(estimated_value), 0) as leadValue, COUNT(*) as leadCount FROM crm_contacts WHERE user_id = ? AND type = 'LEAD' AND status != 'LOST'`,
        [userContext.userId]
      );
      const dealValue = Number(deals[0]?.dealValue || 0);
      const leadValue = Number(leads[0]?.leadValue || 0);
      return {
        dealPipelineValue: dealValue,
        activeDealCount: Number(deals[0]?.dealCount || 0),
        leadEstimatedValue: leadValue,
        activeLeadCount: Number(leads[0]?.leadCount || 0),
        totalCombinedValue: dealValue + leadValue,
        tenantId: userContext.tenantId,
        dataSource: 'INTERNAL_CRM'
      };
    }

    const pool = getCrmDbPool();
    const tenantId = userContext.tenantId;

    let dealRows = [{ dealValue: 0, dealCount: 0 }];
    let leadRows = [{ leadValue: 0, leadCount: 0 }];
    try {
      const [deals] = await pool.query(
        `SELECT COALESCE(SUM(value), 0) as dealValue, COUNT(*) as dealCount 
         FROM deals 
         WHERE tenantId = ? AND stage != 'LOST'`,
        [tenantId]
      );
      dealRows = deals;
      const [leads] = await pool.query(
        `SELECT COALESCE(SUM(estimatedValue), 0) as leadValue, COUNT(*) as leadCount 
         FROM leads 
         WHERE tenantId = ? AND status != 'LOST'`,
        [tenantId]
      );
      leadRows = leads;
    } catch (dbErr) {
      if (dbErr.code !== 'ER_BAD_DB_ERROR' && dbErr.code !== 'ER_NO_SUCH_TABLE') throw dbErr;
    }

    const dealValue = Number(dealRows[0]?.dealValue || 0);
    const leadValue = Number(leadRows[0]?.leadValue || 0);

    return {
      dealPipelineValue: dealValue,
      activeDealCount: Number(dealRows[0]?.dealCount || 0),
      leadEstimatedValue: leadValue,
      activeLeadCount: Number(leadRows[0]?.leadCount || 0),
      totalCombinedValue: dealValue + leadValue,
      tenantId
    };
  }

  /**
   * 6. getOverdueTasks: Tasks where dueDate < NOW() and status != 'COMPLETED'.
   */
  static async getOverdueTasks(userContext) {
    if (userContext.crmDataSource === 'INTERNAL') {
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT id, title, priority, status, due_date as dueDate, 'You' as assignedUser
         FROM crm_tasks
         WHERE user_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED') AND due_date < NOW()
         ORDER BY due_date ASC`,
        [userContext.userId]
      );
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        priority: r.priority,
        status: r.status,
        dueDate: r.dueDate,
        assignedUser: r.assignedUser,
        dataSource: 'INTERNAL_CRM'
      }));
    }

    const pool = getCrmDbPool();
    const tenantId = userContext.tenantId;

    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.priority, t.status, t.dueDate, u.name as assignedUserName 
       FROM tasks t
       LEFT JOIN users u ON t.assignedUserId = u.id
       WHERE t.tenantId = ? AND t.status != 'COMPLETED' AND t.status != 'CANCELLED' AND t.dueDate < NOW()
       ORDER BY t.dueDate ASC`,
      [tenantId]
    );

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      priority: r.priority,
      status: r.status,
      dueDate: r.dueDate,
      assignedUser: r.assignedUserName || 'Unassigned'
    }));
  }

  /**
   * 7. getPendingInvoices: Invoices with status PENDING, DRAFT, or UNPAID.
   */
  static async getPendingInvoices(userContext) {
    const pool = getCrmDbPool();
    const tenantId = userContext.tenantId;

    const [rows] = await pool.query(
      `SELECT id, invoiceNumber, customerName, amount as totalAmount, status, dueDate, createdAt 
       FROM invoices 
       WHERE tenantId = ? AND status IN ('PENDING', 'DRAFT', 'UNPAID')
       ORDER BY createdAt DESC`,
      [tenantId]
    );

    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      customerName: r.customerName,
      totalAmount: Number(r.totalAmount || 0),
      status: r.status,
      dueDate: r.dueDate,
      createdAt: r.createdAt
    }));
  }

  /**
   * 8. getContactDetails: Contact details by ID or search term.
   */
  static async getContactDetails(userContext, { contactId = null, query = null } = {}) {
    if (userContext.crmDataSource === 'INTERNAL') {
      const pool = getPool();
      let rows;
      if (contactId) {
        [rows] = await pool.query(
          `SELECT * FROM crm_contacts WHERE user_id = ? AND id = ?`,
          [userContext.userId, contactId]
        );
      } else if (query) {
        [rows] = await pool.query(
          `SELECT * FROM crm_contacts WHERE user_id = ? AND (first_name LIKE ? OR last_name LIKE ? OR company LIKE ? OR email LIKE ?) LIMIT 1`,
          [userContext.userId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
        );
      } else {
        return null;
      }
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        id: r.id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        company: r.company || '',
        email: r.email,
        phone: r.phone || '',
        type: r.type,
        status: r.status,
        createdAt: r.created_at,
        dataSource: 'INTERNAL_CRM'
      };
    }

    const pool = getCrmDbPool();
    const tenantId = userContext.tenantId;

    let rows;
    if (contactId) {
      [rows] = await pool.query(
        `SELECT id, name, company, email, phone, type, status, createdAt 
         FROM contacts 
         WHERE tenantId = ? AND id = ?`,
        [tenantId, contactId]
      );
    } else if (query) {
      [rows] = await pool.query(
        `SELECT id, name, company, email, phone, type, status, createdAt 
         FROM contacts 
         WHERE tenantId = ? AND (name LIKE ? OR company LIKE ? OR email LIKE ?)
         LIMIT 1`,
        [tenantId, `%${query}%`, `%${query}%`, `%${query}%`]
      );
    } else {
      return null;
    }

    if (!rows || rows.length === 0) return null;
    const r = rows[0];

    return {
      id: r.id,
      name: r.name,
      company: r.company,
      email: r.email,
      phone: r.phone,
      type: r.type,
      status: r.status,
      createdAt: r.createdAt
    };
  }

  /**
   * 9. getDashboardSummary: Aggregate operational snapshot.
   */
  static async getDashboardSummary(userContext) {
    const [leadStats, pipelineStats, overdueTasks, pendingInvoices] = await Promise.all([
      this.getLeadCount(userContext),
      this.getPipelineValue(userContext),
      this.getOverdueTasks(userContext),
      this.getPendingInvoices(userContext)
    ]);

    return {
      tenantId: userContext.tenantId,
      totalLeads: leadStats.count,
      activePipelineValue: pipelineStats.dealPipelineValue,
      leadEstimatedValue: pipelineStats.leadEstimatedValue,
      totalRevenueOpportunity: pipelineStats.totalCombinedValue,
      overdueTasksCount: overdueTasks.length,
      pendingInvoicesCount: pendingInvoices.length
    };
  }
}
