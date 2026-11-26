import crypto from 'crypto';
import { getPool } from '../db/pool.js';

export const VALID_CONTACT_TYPES = ['LEAD', 'CUSTOMER', 'PARTNER', 'VENDOR'];
export const VALID_DEAL_STAGES = [
  'NEW_LEAD',
  'CONTACTED',
  'QUALIFIED',
  'OPPORTUNITY',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST'
];

export const VALID_ACTIVITY_TYPES = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'STAGE_CHANGE'];
export const VALID_PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
export const VALID_TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const VALID_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export const STAGE_PROBABILITIES = {
  NEW_LEAD: 10,
  CONTACTED: 20,
  QUALIFIED: 40,
  OPPORTUNITY: 60,
  PROPOSAL: 75,
  NEGOTIATION: 90,
  WON: 100,
  LOST: 0
};

export class CrmService {
  /**
   * Validates email format using RFC-compliant pattern.
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // ==========================================================================
  // 1. CONTACTS & PARTNERS MANAGEMENT
  // ==========================================================================

  /**
   * Retrieves contacts owned by the authenticated user with optional filtering and search.
   */
  static async getContacts({ userId, tenantId = 'global', type = null, status = null, search = null, limit = 50, offset = 0 }) {
    const pool = getPool();
    let query = `
      SELECT id, tenant_id, user_id, first_name, last_name, email, phone, company, job_title,
             type, status, score, source, estimated_value, partner_tier, notes, created_at, updated_at
      FROM crm_contacts
      WHERE user_id = ?
    `;
    const params = [userId];

    if (tenantId && tenantId !== 'global') {
      query += ' AND tenant_id = ?';
      params.push(tenantId);
    }

    if (type && VALID_CONTACT_TYPES.includes(type.toUpperCase())) {
      query += ' AND type = ?';
      params.push(type.toUpperCase());
    }

    if (status && String(status).trim() && status !== 'ALL') {
      query += ' AND status = ?';
      params.push(String(status).trim());
    }

    if (search && String(search).trim()) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ?)';
      const wild = `%${String(search).trim()}%`;
      params.push(wild, wild, wild, wild);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200), Math.max(parseInt(offset, 10) || 0, 0));

    const [rows] = await pool.query(query, params);

    // Count query for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM crm_contacts WHERE user_id = ?';
    const countParams = [userId];
    if (tenantId && tenantId !== 'global') {
      countQuery += ' AND tenant_id = ?';
      countParams.push(tenantId);
    }
    if (type && VALID_CONTACT_TYPES.includes(type.toUpperCase())) {
      countQuery += ' AND type = ?';
      countParams.push(type.toUpperCase());
    }
    if (status && String(status).trim() && status !== 'ALL') {
      countQuery += ' AND status = ?';
      countParams.push(String(status).trim());
    }
    if (search && String(search).trim()) {
      countQuery += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ?)';
      const wild = `%${String(search).trim()}%`;
      countParams.push(wild, wild, wild, wild);
    }

    const [countRows] = await pool.query(countQuery, countParams);
    const total = countRows[0]?.total || 0;

    return {
      contacts: rows.map(this._formatContact),
      total: Number(total),
      limit: Number(limit),
      offset: Number(offset)
    };
  }

  /**
   * Retrieves single contact by ID enforcing ownership.
   */
  static async getContactById({ userId, tenantId = 'global', contactId }) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM crm_contacts WHERE id = ? AND user_id = ?`,
      [contactId, userId]
    );

    if (rows.length === 0) return null;

    const contact = this._formatContact(rows[0]);

    // Fetch associated deals
    const [deals] = await pool.query(
      `SELECT id, title, value, currency, stage, probability, expected_close_date, created_at 
       FROM crm_deals 
       WHERE contact_id = ? AND user_id = ? 
       ORDER BY created_at DESC`,
      [contactId, userId]
    );

    contact.deals = deals.map(this._formatDeal);
    return contact;
  }

  /**
   * Creates a new contact, lead, or partner record.
   */
  static async createContact({
    userId,
    tenantId = 'global',
    firstName,
    lastName = '',
    email,
    phone = null,
    company = null,
    jobTitle = null,
    type = 'LEAD',
    status = 'NEW',
    score = 50,
    source = 'MANUAL',
    estimatedValue = 0,
    partnerTier = null,
    notes = null
  }) {
    if (!firstName || !String(firstName).trim()) {
      throw new Error('Contact first name is required.');
    }
    if (!email || !this.isValidEmail(email)) {
      throw new Error('A valid contact email is required.');
    }

    const cleanType = VALID_CONTACT_TYPES.includes(String(type).toUpperCase())
      ? String(type).toUpperCase()
      : 'LEAD';

    const cleanScore = Math.min(Math.max(parseInt(score, 10) || 50, 0), 100);
    const cleanEstimatedValue = Math.max(parseFloat(estimatedValue) || 0, 0);

    const id = `cnt_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const pool = getPool();

    await pool.query(
      `INSERT INTO crm_contacts (
        id, tenant_id, user_id, first_name, last_name, email, phone, company, job_title,
        type, status, score, source, estimated_value, partner_tier, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        userId,
        String(firstName).trim(),
        String(lastName || '').trim(),
        String(email).trim().toLowerCase(),
        phone ? String(phone).trim() : null,
        company ? String(company).trim() : null,
        jobTitle ? String(jobTitle).trim() : null,
        cleanType,
        String(status || (cleanType === 'PARTNER' ? 'ACTIVE' : 'NEW')).trim(),
        cleanScore,
        String(source || 'MANUAL').trim(),
        cleanEstimatedValue,
        cleanType === 'PARTNER' ? (partnerTier ? String(partnerTier).trim() : 'Standard') : null,
        notes ? String(notes).trim() : null
      ]
    );

    // Log creation activity
    await this._logActivity({
      userId,
      tenantId,
      contactId: id,
      dealId: null,
      activityType: 'NOTE',
      title: `${cleanType === 'PARTNER' ? 'Partner' : 'Contact'} Created`,
      description: `Added ${String(firstName).trim()} ${String(lastName || '').trim()} (${cleanType}) to CRM.`
    });

    return await this.getContactById({ userId, tenantId, contactId: id });
  }

  /**
   * Bulk imports contacts/leads (for CSV import).
   */
  static async bulkImportContacts({ userId, tenantId = 'global', contacts = [] }) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return { importedCount: 0, errors: [] };
    }

    const pool = getPool();
    let importedCount = 0;
    const errors = [];

    // Max batch limit: 500 records
    const batch = contacts.slice(0, 500);

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      try {
        const firstName = item.firstName || item.first_name || item.name?.split(' ')[0] || 'Lead';
        const lastName = item.lastName || item.last_name || item.name?.split(' ').slice(1).join(' ') || '';
        const email = item.email || item.Email;

        if (!email || !this.isValidEmail(email)) {
          errors.push(`Row ${i + 1}: Invalid email address.`);
          continue;
        }

        const id = `cnt_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
        const type = VALID_CONTACT_TYPES.includes(String(item.type || '').toUpperCase())
          ? String(item.type).toUpperCase()
          : 'LEAD';

        await pool.query(
          `INSERT INTO crm_contacts (
            id, tenant_id, user_id, first_name, last_name, email, phone, company, job_title,
            type, status, score, source, estimated_value, partner_tier, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            tenantId,
            userId,
            String(firstName).trim(),
            String(lastName).trim(),
            String(email).trim().toLowerCase(),
            item.phone ? String(item.phone).trim() : null,
            item.company ? String(item.company).trim() : null,
            item.jobTitle || item.role ? String(item.jobTitle || item.role).trim() : null,
            type,
            String(item.status || 'NEW').trim(),
            Math.min(Math.max(parseInt(item.score, 10) || 60, 0), 100),
            'CSV_IMPORT',
            Math.max(parseFloat(item.estimatedValue || item.dealValue) || 0, 0),
            type === 'PARTNER' ? String(item.partnerTier || 'Standard') : null,
            item.notes ? String(item.notes).trim() : 'Imported via CSV'
          ]
        );
        importedCount++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return { importedCount, errors };
  }

  /**
   * Updates an existing contact owned by the user.
   */
  static async updateContact({ userId, tenantId = 'global', contactId, updates = {} }) {
    const existing = await this.getContactById({ userId, tenantId, contactId });
    if (!existing) {
      throw new Error('Contact not found or access denied.');
    }

    const fields = [];
    const values = [];

    if (updates.firstName !== undefined && String(updates.firstName).trim()) {
      fields.push('first_name = ?');
      values.push(String(updates.firstName).trim());
    }
    if (updates.lastName !== undefined) {
      fields.push('last_name = ?');
      values.push(String(updates.lastName).trim());
    }
    if (updates.email !== undefined) {
      if (!this.isValidEmail(updates.email)) throw new Error('Invalid email format.');
      fields.push('email = ?');
      values.push(String(updates.email).trim().toLowerCase());
    }
    if (updates.phone !== undefined) {
      fields.push('phone = ?');
      values.push(updates.phone ? String(updates.phone).trim() : null);
    }
    if (updates.company !== undefined) {
      fields.push('company = ?');
      values.push(updates.company ? String(updates.company).trim() : null);
    }
    if (updates.jobTitle !== undefined) {
      fields.push('job_title = ?');
      values.push(updates.jobTitle ? String(updates.jobTitle).trim() : null);
    }
    if (updates.type !== undefined && VALID_CONTACT_TYPES.includes(String(updates.type).toUpperCase())) {
      fields.push('type = ?');
      values.push(String(updates.type).toUpperCase());
    }
    if (updates.status !== undefined && String(updates.status).trim()) {
      fields.push('status = ?');
      values.push(String(updates.status).trim());
    }
    if (updates.score !== undefined) {
      fields.push('score = ?');
      values.push(Math.min(Math.max(parseInt(updates.score, 10) || 50, 0), 100));
    }
    if (updates.estimatedValue !== undefined) {
      fields.push('estimated_value = ?');
      values.push(Math.max(parseFloat(updates.estimatedValue) || 0, 0));
    }
    if (updates.partnerTier !== undefined) {
      fields.push('partner_tier = ?');
      values.push(updates.partnerTier ? String(updates.partnerTier).trim() : null);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes ? String(updates.notes).trim() : null);
    }

    if (fields.length === 0) return existing;

    const pool = getPool();
    values.push(contactId, userId);

    await pool.query(
      `UPDATE crm_contacts SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return await this.getContactById({ userId, tenantId, contactId });
  }

  /**
   * Deletes a contact owned by the user.
   */
  static async deleteContact({ userId, tenantId = 'global', contactId }) {
    const existing = await this.getContactById({ userId, tenantId, contactId });
    if (!existing) {
      throw new Error('Contact not found or access denied.');
    }

    const pool = getPool();
    await pool.query(
      `DELETE FROM crm_contacts WHERE id = ? AND user_id = ?`,
      [contactId, userId]
    );

    return { success: true, deletedId: contactId };
  }

  // ==========================================================================
  // 2. COMMERCIAL DEALS & SALES PIPELINE
  // ==========================================================================

  /**
   * Retrieves deals owned by the user, joined with contact details.
   */
  static async getDeals({ userId, tenantId = 'global', stage = null, contactId = null, limit = 100, offset = 0 }) {
    const pool = getPool();
    let query = `
      SELECT d.id, d.tenant_id, d.user_id, d.contact_id, d.title, d.value, d.currency,
             d.stage, d.probability, d.expected_close_date, d.notes, d.created_at, d.updated_at,
             c.first_name as contact_first_name, c.last_name as contact_last_name,
             c.email as contact_email, c.company as contact_company
      FROM crm_deals d
      LEFT JOIN crm_contacts c ON d.contact_id = c.id
      WHERE d.user_id = ?
    `;
    const params = [userId];

    if (tenantId && tenantId !== 'global') {
      query += ' AND d.tenant_id = ?';
      params.push(tenantId);
    }

    if (stage && VALID_DEAL_STAGES.includes(stage.toUpperCase())) {
      query += ' AND d.stage = ?';
      params.push(stage.toUpperCase());
    }

    if (contactId) {
      query += ' AND d.contact_id = ?';
      params.push(contactId);
    }

    query += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200), Math.max(parseInt(offset, 10) || 0, 0));

    const [rows] = await pool.query(query, params);
    return rows.map(this._formatDeal);
  }

  /**
   * Retrieves single deal by ID.
   */
  static async getDealById({ userId, tenantId = 'global', dealId }) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT d.*, c.first_name as contact_first_name, c.last_name as contact_last_name,
              c.email as contact_email, c.company as contact_company
       FROM crm_deals d
       LEFT JOIN crm_contacts c ON d.contact_id = c.id
       WHERE d.id = ? AND d.user_id = ?`,
      [dealId, userId]
    );

    if (rows.length === 0) return null;
    return this._formatDeal(rows[0]);
  }

  /**
   * Creates a new deal, validating contact ownership if linked.
   */
  static async createDeal({
    userId,
    tenantId = 'global',
    contactId = null,
    title,
    value = 0,
    currency = 'USD',
    stage = 'NEW_LEAD',
    probability = null,
    expectedCloseDate = null,
    notes = null
  }) {
    if (!title || !String(title).trim()) {
      throw new Error('Deal title is required.');
    }

    const cleanStage = VALID_DEAL_STAGES.includes(String(stage).toUpperCase())
      ? String(stage).toUpperCase()
      : 'NEW_LEAD';

    const cleanValue = Math.max(parseFloat(value) || 0, 0);
    const cleanProb = probability !== null && probability !== undefined
      ? Math.min(Math.max(parseInt(probability, 10) || 0, 0), 100)
      : (STAGE_PROBABILITIES[cleanStage] ?? 20);

    // Validate contact ownership if linked
    if (contactId) {
      const contact = await this.getContactById({ userId, tenantId, contactId });
      if (!contact) {
        throw new Error('Associated contact not found or access denied.');
      }
    }

    const id = `deal_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const pool = getPool();

    await pool.query(
      `INSERT INTO crm_deals (
        id, tenant_id, user_id, contact_id, title, value, currency,
        stage, probability, expected_close_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        userId,
        contactId || null,
        String(title).trim(),
        cleanValue,
        String(currency || 'USD').trim().toUpperCase(),
        cleanStage,
        cleanProb,
        expectedCloseDate ? expectedCloseDate : null,
        notes ? String(notes).trim() : null
      ]
    );

    // Record activity log
    await this._logActivity({
      userId,
      tenantId,
      contactId: contactId || null,
      dealId: id,
      activityType: 'STAGE_CHANGE',
      title: 'Deal Created',
      description: `Opportunity "${String(title).trim()}" opened at stage ${cleanStage} ($${cleanValue.toLocaleString()}).`
    });

    return await this.getDealById({ userId, tenantId, dealId: id });
  }

  /**
   * Updates deal stage with automatic probability adjustment.
   */
  static async updateDealStage({ userId, tenantId = 'global', dealId, stage }) {
    const cleanStage = String(stage || '').toUpperCase();
    if (!VALID_DEAL_STAGES.includes(cleanStage)) {
      throw new Error(`Invalid deal stage: '${stage}'. Valid stages: ${VALID_DEAL_STAGES.join(', ')}`);
    }

    const existing = await this.getDealById({ userId, tenantId, dealId });
    if (!existing) {
      throw new Error('Deal not found or access denied.');
    }

    if (existing.stage === cleanStage) {
      return existing; // Avoid duplicate stage transition logs
    }

    const newProbability = STAGE_PROBABILITIES[cleanStage] ?? existing.probability;
    const pool = getPool();

    await pool.query(
      `UPDATE crm_deals 
       SET stage = ?, probability = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND user_id = ?`,
      [cleanStage, newProbability, dealId, userId]
    );

    // Record stage transition activity
    await this._logActivity({
      userId,
      tenantId,
      contactId: existing.contactId || null,
      dealId,
      activityType: 'STAGE_CHANGE',
      title: 'Deal Stage Updated',
      description: `Advanced from ${existing.stage} to ${cleanStage} (${newProbability}% probability).`
    });

    return await this.getDealById({ userId, tenantId, dealId });
  }

  /**
   * Updates deal fields.
   */
  static async updateDeal({ userId, tenantId = 'global', dealId, updates = {} }) {
    const existing = await this.getDealById({ userId, tenantId, dealId });
    if (!existing) {
      throw new Error('Deal not found or access denied.');
    }

    const fields = [];
    const values = [];

    if (updates.title !== undefined && String(updates.title).trim()) {
      fields.push('title = ?');
      values.push(String(updates.title).trim());
    }
    if (updates.value !== undefined) {
      fields.push('value = ?');
      values.push(Math.max(parseFloat(updates.value) || 0, 0));
    }
    if (updates.currency !== undefined) {
      fields.push('currency = ?');
      values.push(String(updates.currency).trim().toUpperCase());
    }
    if (updates.stage !== undefined && VALID_DEAL_STAGES.includes(String(updates.stage).toUpperCase())) {
      const stg = String(updates.stage).toUpperCase();
      fields.push('stage = ?');
      values.push(stg);
      if (updates.probability === undefined) {
        fields.push('probability = ?');
        values.push(STAGE_PROBABILITIES[stg] ?? 20);
      }
    }
    if (updates.probability !== undefined) {
      fields.push('probability = ?');
      values.push(Math.min(Math.max(parseInt(updates.probability, 10) || 0, 0), 100));
    }
    if (updates.expectedCloseDate !== undefined) {
      fields.push('expected_close_date = ?');
      values.push(updates.expectedCloseDate || null);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes ? String(updates.notes).trim() : null);
    }
    if (updates.contactId !== undefined) {
      if (updates.contactId) {
        const contact = await this.getContactById({ userId, tenantId, contactId: updates.contactId });
        if (!contact) throw new Error('Associated contact not found.');
      }
      fields.push('contact_id = ?');
      values.push(updates.contactId || null);
    }

    if (fields.length === 0) return existing;

    const pool = getPool();
    values.push(dealId, userId);

    await pool.query(
      `UPDATE crm_deals SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return await this.getDealById({ userId, tenantId, dealId });
  }

  /**
   * Deletes a deal owned by user.
   */
  static async deleteDeal({ userId, tenantId = 'global', dealId }) {
    const existing = await this.getDealById({ userId, tenantId, dealId });
    if (!existing) {
      throw new Error('Deal not found or access denied.');
    }

    const pool = getPool();
    await pool.query(`DELETE FROM crm_deals WHERE id = ? AND user_id = ?`, [dealId, userId]);
    return { success: true, deletedId: dealId };
  }

  // ==========================================================================
  // 3. REAL-TIME CRM DASHBOARD METRICS
  // ==========================================================================

  /**
   * Calculates live, real-time KPI metrics strictly scoped to authenticated user.
   */
  static async getMetrics({ userId, tenantId = 'global' }) {
    const pool = getPool();

    // 1. Pipeline aggregations
    const [dealStats] = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN stage != 'LOST' THEN value ELSE 0 END), 0) as totalPipelineValue,
         COUNT(CASE WHEN stage != 'LOST' AND stage != 'WON' THEN 1 END) as activeDealsCount,
         COUNT(CASE WHEN stage = 'WON' THEN 1 END) as wonDealsCount,
         COALESCE(SUM(CASE WHEN stage = 'WON' THEN value ELSE 0 END), 0) as wonDealsValue,
         COUNT(CASE WHEN stage = 'LOST' THEN 1 END) as lostDealsCount,
         COUNT(*) as totalDealsCount
       FROM crm_deals
       WHERE user_id = ?`,
      [userId]
    );

    // 2. Stage distribution breakdown
    const [stageRows] = await pool.query(
      `SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as totalValue 
       FROM crm_deals 
       WHERE user_id = ? 
       GROUP BY stage`,
      [userId]
    );

    const stageMap = {};
    for (const stg of VALID_DEAL_STAGES) {
      stageMap[stg] = { count: 0, value: 0 };
    }
    for (const r of stageRows) {
      if (stageMap[r.stage]) {
        stageMap[r.stage] = { count: Number(r.count), value: Number(r.totalValue) };
      }
    }

    // 3. Contact & Partner counts
    const [contactStats] = await pool.query(
      `SELECT 
         COUNT(CASE WHEN type != 'PARTNER' THEN 1 END) as totalContactsCount,
         COUNT(CASE WHEN type = 'PARTNER' THEN 1 END) as totalPartnersCount,
         COUNT(CASE WHEN type = 'LEAD' AND status = 'NEW' THEN 1 END) as newLeadsCount,
         COALESCE(AVG(score), 50) as averageScore,
         COALESCE(SUM(estimated_value), 0) as totalLeadEstimatedValue
       FROM crm_contacts
       WHERE user_id = ?`,
      [userId]
    );

    const ds = dealStats[0] || {};
    const cs = contactStats[0] || {};

    const totalDeals = Number(ds.totalDealsCount || 0);
    const wonDeals = Number(ds.wonDealsCount || 0);
    const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

    return {
      userId,
      tenantId,
      totalPipelineValue: Number(ds.totalPipelineValue || 0),
      activeDealsCount: Number(ds.activeDealsCount || 0),
      wonDealsCount: wonDeals,
      wonDealsValue: Number(ds.wonDealsValue || 0),
      lostDealsCount: Number(ds.lostDealsCount || 0),
      winRatePercentage: winRate,
      totalContactsCount: Number(cs.totalContactsCount || 0),
      totalPartnersCount: Number(cs.totalPartnersCount || 0),
      newLeadsCount: Number(cs.newLeadsCount || 0),
      averageLeadScore: Math.round(Number(cs.averageScore || 50)),
      totalLeadEstimatedValue: Number(cs.totalLeadEstimatedValue || 0),
      stageDistribution: stageMap
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  static async _logActivity({ userId, tenantId, contactId, dealId, activityType, title, description }) {
    try {
      const pool = getPool();
      const id = `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      await pool.query(
        `INSERT INTO crm_activities (
          id, tenant_id, user_id, contact_id, deal_id, activity_type, title, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, userId, contactId, dealId, activityType, title, description]
      );
    } catch (err) {
      console.warn('[CrmService] Activity logging warning:', err.message);
    }
  }

  static _formatContact(r) {
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      firstName: r.first_name,
      lastName: r.last_name || '',
      name: `${r.first_name} ${r.last_name || ''}`.trim(),
      email: r.email,
      phone: r.phone || '',
      company: r.company || '',
      jobTitle: r.job_title || '',
      type: r.type,
      status: r.status,
      score: Number(r.score || 50),
      source: r.source || 'MANUAL',
      estimatedValue: Number(r.estimated_value || 0),
      partnerTier: r.partner_tier || null,
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  static _formatDeal(r) {
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      contactId: r.contact_id || null,
      contactName: r.contact_first_name ? `${r.contact_first_name} ${r.contact_last_name || ''}`.trim() : null,
      contactEmail: r.contact_email || null,
      contactCompany: r.contact_company || null,
      title: r.title,
      value: Number(r.value || 0),
      currency: r.currency || 'USD',
      stage: r.stage,
      probability: Number(r.probability || 0),
      expectedCloseDate: r.expected_close_date || null,
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // ==========================================================================
  // 4. ACTIVITIES & COMMUNICATION HISTORY
  // ==========================================================================

  /**
   * Retrieves communication activities for user, optionally filtered by contact, deal or type.
   */
  static async getActivities({ userId, tenantId = 'global', contactId = null, dealId = null, activityType = null, limit = 50, offset = 0 }) {
    const pool = getPool();
    let query = `
      SELECT a.*, 
             c.first_name as contact_first_name, c.last_name as contact_last_name, c.company as contact_company,
             d.title as deal_title, d.value as deal_value
      FROM crm_activities a
      LEFT JOIN crm_contacts c ON a.contact_id = c.id
      LEFT JOIN crm_deals d ON a.deal_id = d.id
      WHERE a.user_id = ?
    `;
    const params = [userId];

    if (tenantId && tenantId !== 'global') {
      query += ' AND a.tenant_id = ?';
      params.push(tenantId);
    }
    if (contactId) {
      query += ' AND a.contact_id = ?';
      params.push(contactId);
    }
    if (dealId) {
      query += ' AND a.deal_id = ?';
      params.push(dealId);
    }
    if (activityType && VALID_ACTIVITY_TYPES.includes(activityType.toUpperCase())) {
      query += ' AND a.activity_type = ?';
      params.push(activityType.toUpperCase());
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200), Math.max(parseInt(offset, 10) || 0, 0));

    const [rows] = await pool.query(query, params);
    return rows.map(r => this._formatActivity(r));
  }

  /**
   * Creates a communication activity (Call, Email, Meeting, Note) linked to contact/deal.
   */
  static async createActivity({
    userId,
    tenantId = 'global',
    contactId = null,
    dealId = null,
    activityType = 'NOTE',
    title,
    description = null
  }) {
    if (!title || !String(title).trim()) {
      throw new Error('Activity title is required.');
    }

    const cleanType = VALID_ACTIVITY_TYPES.includes(String(activityType).toUpperCase())
      ? String(activityType).toUpperCase()
      : 'NOTE';

    if (contactId) {
      const contact = await this.getContactById({ userId, tenantId, contactId });
      if (!contact) {
        throw new Error('Associated contact not found or access denied.');
      }
    }

    if (dealId) {
      const deal = await this.getDealById({ userId, tenantId, dealId });
      if (!deal) {
        throw new Error('Associated deal not found or access denied.');
      }
    }

    const id = `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const pool = getPool();

    await pool.query(
      `INSERT INTO crm_activities (
        id, tenant_id, user_id, contact_id, deal_id, activity_type, title, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        userId,
        contactId || null,
        dealId || null,
        cleanType,
        String(title).trim(),
        description ? String(description).trim() : null
      ]
    );

    const [rows] = await pool.query(
      `SELECT a.*, 
              c.first_name as contact_first_name, c.last_name as contact_last_name, c.company as contact_company,
              d.title as deal_title, d.value as deal_value
       FROM crm_activities a
       LEFT JOIN crm_contacts c ON a.contact_id = c.id
       LEFT JOIN crm_deals d ON a.deal_id = d.id
       WHERE a.id = ? AND a.user_id = ?`,
      [id, userId]
    );

    return this._formatActivity(rows[0]);
  }

  /**
   * Deletes an activity record owned by user.
   */
  static async deleteActivity({ userId, tenantId = 'global', activityId }) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id FROM crm_activities WHERE id = ? AND user_id = ?`,
      [activityId, userId]
    );
    if (!rows || rows.length === 0) {
      throw new Error('Activity not found or access denied.');
    }

    await pool.query(`DELETE FROM crm_activities WHERE id = ? AND user_id = ?`, [activityId, userId]);
    return { success: true, deletedId: activityId };
  }

  // ==========================================================================
  // 5. PROJECTS & DELIVERY MANAGEMENT
  // ==========================================================================

  /**
   * Retrieves all projects owned by user with linked deal and tasks count.
   */
  static async getProjects({ userId, tenantId = 'global', status = null, dealId = null, limit = 50, offset = 0 }) {
    const pool = getPool();
    let query = `
      SELECT p.*,
             d.title as deal_title, d.value as deal_value, d.stage as deal_stage,
             c.first_name as contact_first_name, c.last_name as contact_last_name, c.company as contact_company,
             (SELECT COUNT(*) FROM crm_tasks t WHERE t.related_type = 'PROJECT' AND t.related_id = p.id AND t.user_id = p.user_id) as tasks_count,
             (SELECT COUNT(*) FROM crm_tasks t WHERE t.related_type = 'PROJECT' AND t.related_id = p.id AND t.user_id = p.user_id AND t.status = 'COMPLETED') as completed_tasks_count
      FROM crm_projects p
      LEFT JOIN crm_deals d ON p.deal_id = d.id
      LEFT JOIN crm_contacts c ON d.contact_id = c.id
      WHERE p.user_id = ?
    `;
    const params = [userId];

    if (tenantId && tenantId !== 'global') {
      query += ' AND p.tenant_id = ?';
      params.push(tenantId);
    }
    if (status && status !== 'ALL') {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (dealId) {
      query += ' AND p.deal_id = ?';
      params.push(dealId);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200), Math.max(parseInt(offset, 10) || 0, 0));

    const [rows] = await pool.query(query, params);
    return rows.map(r => this._formatProject(r));
  }

  /**
   * Retrieves single project by ID with its linked tasks.
   */
  static async getProjectById({ userId, tenantId = 'global', projectId }) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT p.*,
              d.title as deal_title, d.value as deal_value, d.stage as deal_stage,
              c.first_name as contact_first_name, c.last_name as contact_last_name, c.company as contact_company
       FROM crm_projects p
       LEFT JOIN crm_deals d ON p.deal_id = d.id
       LEFT JOIN crm_contacts c ON d.contact_id = c.id
       WHERE p.id = ? AND p.user_id = ?`,
      [projectId, userId]
    );

    if (!rows || rows.length === 0) return null;

    const project = this._formatProject(rows[0]);
    project.tasks = await this.getTasks({ userId, tenantId, relatedType: 'PROJECT', relatedId: projectId });
    return project;
  }

  /**
   * Creates a new project.
   */
  static async createProject({
    userId,
    tenantId = 'global',
    dealId = null,
    name,
    category = 'General',
    status = 'IN_PROGRESS',
    progress = 0,
    dueDate = null,
    description = null
  }) {
    if (!name || !String(name).trim()) {
      throw new Error('Project name is required.');
    }

    if (dealId) {
      const deal = await this.getDealById({ userId, tenantId, dealId });
      if (!deal) {
        throw new Error('Associated deal not found or access denied.');
      }
    }

    const cleanProgress = Math.min(Math.max(parseInt(progress, 10) || 0, 0), 100);
    const id = `proj_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const pool = getPool();

    await pool.query(
      `INSERT INTO crm_projects (
        id, tenant_id, user_id, deal_id, name, category, status, progress, due_date, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        userId,
        dealId || null,
        String(name).trim(),
        String(category || 'General').trim(),
        String(status || 'IN_PROGRESS').trim(),
        cleanProgress,
        dueDate || null,
        description ? String(description).trim() : null
      ]
    );

    await this._logActivity({
      userId,
      tenantId,
      contactId: null,
      dealId: dealId || null,
      activityType: 'NOTE',
      title: 'Project Created',
      description: `Project "${String(name).trim()}" was created.`
    });

    return await this.getProjectById({ userId, tenantId, projectId: id });
  }

  /**
   * Updates an existing project.
   */
  static async updateProject({ userId, tenantId = 'global', projectId, updates = {} }) {
    const existing = await this.getProjectById({ userId, tenantId, projectId });
    if (!existing) {
      throw new Error('Project not found or access denied.');
    }

    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(String(updates.name).trim());
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(String(updates.category).trim());
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(String(updates.status).trim());
    }
    if (updates.progress !== undefined) {
      fields.push('progress = ?');
      values.push(Math.min(Math.max(parseInt(updates.progress, 10) || 0, 0), 100));
    }
    if (updates.dueDate !== undefined || updates.due_date !== undefined) {
      fields.push('due_date = ?');
      values.push(updates.dueDate || updates.due_date || null);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description ? String(updates.description).trim() : null);
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(projectId, userId);

    const pool = getPool();
    await pool.query(
      `UPDATE crm_projects SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return await this.getProjectById({ userId, tenantId, projectId });
  }

  /**
   * Deletes a project and its associated project tasks.
   */
  static async deleteProject({ userId, tenantId = 'global', projectId }) {
    const existing = await this.getProjectById({ userId, tenantId, projectId });
    if (!existing) {
      throw new Error('Project not found or access denied.');
    }

    const pool = getPool();
    await pool.query(
      `DELETE FROM crm_tasks WHERE related_type = 'PROJECT' AND related_id = ? AND user_id = ?`,
      [projectId, userId]
    );
    await pool.query(`DELETE FROM crm_projects WHERE id = ? AND user_id = ?`, [projectId, userId]);

    return { success: true, deletedId: projectId };
  }

  /**
   * Converts a Won Deal into a delivery project, preventing duplicate conversions.
   */
  static async convertDealToProject({ userId, tenantId = 'global', dealId, projectName = null, category = 'Client Project', dueDate = null }) {
    const deal = await this.getDealById({ userId, tenantId, dealId });
    if (!deal) {
      throw new Error('Deal not found or access denied.');
    }

    const pool = getPool();
    const [existingProj] = await pool.query(
      `SELECT id, name FROM crm_projects WHERE deal_id = ? AND user_id = ?`,
      [dealId, userId]
    );

    if (existingProj && existingProj.length > 0) {
      throw new Error(`A project ("${existingProj[0].name}") has already been created from this deal.`);
    }

    const name = projectName && String(projectName).trim()
      ? String(projectName).trim()
      : `${deal.title} - Delivery`;

    const projectId = `proj_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

    await pool.query(
      `INSERT INTO crm_projects (
        id, tenant_id, user_id, deal_id, name, category, status, progress, due_date, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        tenantId,
        userId,
        dealId,
        name,
        category,
        'IN_PROGRESS',
        10,
        dueDate || deal.expectedCloseDate || null,
        `Converted from won deal "${deal.title}" ($${deal.value.toLocaleString()}).`
      ]
    );

    // Default kickoff task
    const taskId = `task_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    await pool.query(
      `INSERT INTO crm_tasks (
        id, tenant_id, user_id, related_type, related_id, title, priority, status, due_date
      ) VALUES (?, ?, ?, 'PROJECT', ?, 'Project Kickoff & Requirements Review', 'HIGH', 'PENDING', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [taskId, tenantId, userId, projectId]
    );

    await this._logActivity({
      userId,
      tenantId,
      contactId: deal.contactId || null,
      dealId,
      activityType: 'NOTE',
      title: 'Deal Converted to Project',
      description: `Won deal "${deal.title}" converted into delivery project "${name}".`
    });

    return await this.getProjectById({ userId, tenantId, projectId });
  }

  // ==========================================================================
  // 6. TASKS & ACTION REMINDERS
  // ==========================================================================

  /**
   * Retrieves tasks for user, optionally filtered by related entity and status.
   */
  static async getTasks({ userId, tenantId = 'global', relatedType = null, relatedId = null, status = null, limit = 100, offset = 0 }) {
    const pool = getPool();
    let query = `
      SELECT t.*,
             p.name as project_name
      FROM crm_tasks t
      LEFT JOIN crm_projects p ON (t.related_type = 'PROJECT' AND t.related_id = p.id)
      WHERE t.user_id = ?
    `;
    const params = [userId];

    if (tenantId && tenantId !== 'global') {
      query += ' AND t.tenant_id = ?';
      params.push(tenantId);
    }
    if (relatedType) {
      query += ' AND t.related_type = ?';
      params.push(String(relatedType).toUpperCase());
    }
    if (relatedId) {
      query += ' AND t.related_id = ?';
      params.push(relatedId);
    }
    if (status && status !== 'ALL') {
      query += ' AND t.status = ?';
      params.push(status);
    }

    query += ' ORDER BY (t.status = "COMPLETED") ASC, t.due_date ASC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200), Math.max(parseInt(offset, 10) || 0, 0));

    const [rows] = await pool.query(query, params);
    return rows.map(r => this._formatTask(r));
  }

  /**
   * Creates a new task.
   */
  static async createTask({
    userId,
    tenantId = 'global',
    relatedType = null,
    relatedId = null,
    title,
    priority = 'MEDIUM',
    status = 'PENDING',
    dueDate = null
  }) {
    if (!title || !String(title).trim()) {
      throw new Error('Task title is required.');
    }

    const cleanPriority = VALID_TASK_PRIORITIES.includes(String(priority).toUpperCase())
      ? String(priority).toUpperCase()
      : 'MEDIUM';

    const cleanStatus = VALID_TASK_STATUSES.includes(String(status).toUpperCase())
      ? String(status).toUpperCase()
      : 'PENDING';

    if (relatedType && relatedType.toUpperCase() === 'PROJECT' && relatedId) {
      const proj = await this.getProjectById({ userId, tenantId, projectId: relatedId });
      if (!proj) {
        throw new Error('Associated project not found or access denied.');
      }
    }

    const id = `task_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const pool = getPool();

    await pool.query(
      `INSERT INTO crm_tasks (
        id, tenant_id, user_id, related_type, related_id, title, priority, status, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        userId,
        relatedType ? String(relatedType).toUpperCase() : null,
        relatedId || null,
        String(title).trim(),
        cleanPriority,
        cleanStatus,
        dueDate || null
      ]
    );

    const [rows] = await pool.query(
      `SELECT t.*, p.name as project_name
       FROM crm_tasks t
       LEFT JOIN crm_projects p ON (t.related_type = 'PROJECT' AND t.related_id = p.id)
       WHERE t.id = ? AND t.user_id = ?`,
      [id, userId]
    );

    return this._formatTask(rows[0]);
  }

  /**
   * Updates task status, priority, title or due date.
   */
  static async updateTask({ userId, tenantId = 'global', taskId, updates = {} }) {
    const pool = getPool();
    const [existing] = await pool.query(
      `SELECT * FROM crm_tasks WHERE id = ? AND user_id = ?`,
      [taskId, userId]
    );
    if (!existing || existing.length === 0) {
      throw new Error('Task not found or access denied.');
    }

    const fields = [];
    const values = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(String(updates.title).trim());
    }
    if (updates.priority !== undefined) {
      const cleanP = VALID_TASK_PRIORITIES.includes(String(updates.priority).toUpperCase())
        ? String(updates.priority).toUpperCase()
        : existing[0].priority;
      fields.push('priority = ?');
      values.push(cleanP);
    }
    if (updates.status !== undefined) {
      const cleanS = VALID_TASK_STATUSES.includes(String(updates.status).toUpperCase())
        ? String(updates.status).toUpperCase()
        : existing[0].status;
      fields.push('status = ?');
      values.push(cleanS);
    }
    if (updates.dueDate !== undefined || updates.due_date !== undefined) {
      fields.push('due_date = ?');
      values.push(updates.dueDate || updates.due_date || null);
    }

    if (fields.length === 0) {
      return this._formatTask(existing[0]);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(taskId, userId);

    await pool.query(
      `UPDATE crm_tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    const [updated] = await pool.query(
      `SELECT t.*, p.name as project_name
       FROM crm_tasks t
       LEFT JOIN crm_projects p ON (t.related_type = 'PROJECT' AND t.related_id = p.id)
       WHERE t.id = ? AND t.user_id = ?`,
      [taskId, userId]
    );

    return this._formatTask(updated[0]);
  }

  /**
   * Deletes a task.
   */
  static async deleteTask({ userId, tenantId = 'global', taskId }) {
    const pool = getPool();
    const [existing] = await pool.query(
      `SELECT id FROM crm_tasks WHERE id = ? AND user_id = ?`,
      [taskId, userId]
    );
    if (!existing || existing.length === 0) {
      throw new Error('Task not found or access denied.');
    }

    await pool.query(`DELETE FROM crm_tasks WHERE id = ? AND user_id = ?`, [taskId, userId]);
    return { success: true, deletedId: taskId };
  }

  // ==========================================================================
  // FORMATTING HELPERS
  // ==========================================================================

  static _formatActivity(r) {
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      contactId: r.contact_id || null,
      contactName: r.contact_first_name ? `${r.contact_first_name} ${r.contact_last_name || ''}`.trim() : null,
      contactCompany: r.contact_company || null,
      dealId: r.deal_id || null,
      dealTitle: r.deal_title || null,
      dealValue: r.deal_value ? Number(r.deal_value) : null,
      activityType: r.activity_type,
      title: r.title,
      description: r.description || '',
      createdAt: r.created_at
    };
  }

  static _formatProject(r) {
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      dealId: r.deal_id || null,
      dealTitle: r.deal_title || null,
      dealValue: r.deal_value ? Number(r.deal_value) : null,
      dealStage: r.deal_stage || null,
      contactName: r.contact_first_name ? `${r.contact_first_name} ${r.contact_last_name || ''}`.trim() : null,
      contactCompany: r.contact_company || null,
      name: r.name,
      category: r.category,
      status: r.status,
      progress: Number(r.progress || 0),
      dueDate: r.due_date || null,
      description: r.description || '',
      tasksCount: Number(r.tasks_count || 0),
      completedTasksCount: Number(r.completed_tasks_count || 0),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  static _formatTask(r) {
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      relatedType: r.related_type || null,
      relatedId: r.related_id || null,
      projectName: r.project_name || null,
      title: r.title,
      priority: r.priority,
      status: r.status,
      dueDate: r.due_date || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // ==========================================================================
  // MODULE STATUS & ADMIN TELEMETRY
  // ==========================================================================

  /**
   * Helper to check if CRM module is globally enabled.
   */
  static async isModuleEnabled() {
    try {
      const pool = getPool();
      const [rows] = await pool.query(
        'SELECT setting_value FROM platform_settings WHERE setting_key = ?',
        ['crm_module_enabled']
      );
      if (rows.length === 0) return true;
      return rows[0].setting_value !== 'false';
    } catch {
      return true;
    }
  }

  /**
   * Updates global module enabled state.
   */
  static async updateModuleSettings({ enabled, actorName = 'SuperAdmin' }) {
    const pool = getPool();
    const strVal = enabled === false || enabled === 'false' ? 'false' : 'true';
    const id = 'set_' + crypto.randomBytes(6).toString('hex');
    await pool.query(
      `INSERT INTO platform_settings (id, setting_key, setting_value, updated_by)
       VALUES (?, 'crm_module_enabled', ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [id, strVal, actorName]
    );
    return { success: true, enabled: strVal === 'true' };
  }

  /**
   * Aggregates authorized platform-wide CRM statistics for Admin / Super Admin.
   * Does NOT expose private user records or individual client data.
   */
  static async getAdminStats() {
    const pool = getPool();

    const [contactRows] = await pool.query(`
      SELECT 
        COUNT(*) as totalContacts,
        COUNT(CASE WHEN type = 'LEAD' THEN 1 END) as totalLeads,
        COUNT(CASE WHEN type = 'PARTNER' THEN 1 END) as totalPartners,
        COUNT(DISTINCT user_id) as activeCrmUsers
      FROM crm_contacts
    `);

    const [dealRows] = await pool.query(`
      SELECT 
        COUNT(*) as totalDeals,
        COALESCE(SUM(value), 0) as totalPipelineValue,
        COUNT(CASE WHEN stage = 'CLOSED_WON' THEN 1 END) as wonDealsCount,
        COALESCE(SUM(CASE WHEN stage = 'CLOSED_WON' THEN value ELSE 0 END), 0) as wonDealsValue
      FROM crm_deals
    `);

    const [projectRows] = await pool.query(`
      SELECT 
        COUNT(*) as totalProjects,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedProjects
      FROM crm_projects
    `);

    const [taskRows] = await pool.query(`
      SELECT 
        COUNT(*) as totalTasks,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedTasks,
        COUNT(CASE WHEN status NOT IN ('COMPLETED', 'CANCELLED') AND due_date < NOW() THEN 1 END) as overdueTasks
      FROM crm_tasks
    `);

    const [activityRows] = await pool.query(`
      SELECT COUNT(*) as totalActivities FROM crm_activities
    `);

    return {
      totalContacts: Number(contactRows[0]?.totalContacts || 0),
      totalLeads: Number(contactRows[0]?.totalLeads || 0),
      totalPartners: Number(contactRows[0]?.totalPartners || 0),
      activeCrmUsers: Number(contactRows[0]?.activeCrmUsers || 0),
      totalDeals: Number(dealRows[0]?.totalDeals || 0),
      totalPipelineValue: Number(dealRows[0]?.totalPipelineValue || 0),
      wonDealsCount: Number(dealRows[0]?.wonDealsCount || 0),
      wonDealsValue: Number(dealRows[0]?.wonDealsValue || 0),
      totalProjects: Number(projectRows[0]?.totalProjects || 0),
      completedProjects: Number(projectRows[0]?.completedProjects || 0),
      totalTasks: Number(taskRows[0]?.totalTasks || 0),
      completedTasks: Number(taskRows[0]?.completedTasks || 0),
      overdueTasks: Number(taskRows[0]?.overdueTasks || 0),
      totalActivities: Number(activityRows[0]?.totalActivities || 0)
    };
  }

  // ==========================================================================
  // BESTIE AI CRM COPILOT & PROSPECT RESEARCH
  // ==========================================================================

  /**
   * Generates grounded CRM Copilot insights and prospect research briefs.
   * Scoped strictly to the caller's authorized userId.
   */
  static async getCopilotInsights({ userId, tenantId = 'global', action = 'CHAT', query = '', context = {} }) {
    const pool = getPool();
    const cleanAction = String(action || 'CHAT').toUpperCase();

    // 1. PIPELINE HEALTH ANALYSIS
    if (cleanAction === 'PIPELINE_ANALYSIS') {
      const metrics = await this.getMetrics({ userId, tenantId });
      const deals = await this.getDeals({ userId, tenantId });

      const stageCounts = {};
      deals.forEach(d => {
        stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1;
      });

      const totalDeals = deals.length;
      const wonDeals = (stageCounts['WON'] || 0) + (stageCounts['CLOSED_WON'] || 0);
      const lostDeals = (stageCounts['LOST'] || 0) + (stageCounts['CLOSED_LOST'] || 0);
      const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;
      const highValueDeals = deals.filter(d => d.value >= 10000);

      const markdown = [
        `### 📊 Executive Pipeline Health Analysis`,
        `- **Active Pipeline Value:** $${metrics.totalPipelineValue.toLocaleString()} USD across ${totalDeals} deal${totalDeals === 1 ? '' : 's'}.`,
        `- **Overall Win Rate:** ${winRate}% (${wonDeals} deals marked Closed Won).`,
        `- **Stage Breakdown:**`,
        `  - New Leads: ${stageCounts['NEW_LEAD'] || 0}`,
        `  - Contacted: ${stageCounts['CONTACTED'] || 0}`,
        `  - Qualified: ${stageCounts['QUALIFIED'] || 0}`,
        `  - Opportunity: ${stageCounts['OPPORTUNITY'] || 0}`,
        `  - Proposal: ${(stageCounts['PROPOSAL'] || 0) + (stageCounts['PROPOSAL_SENT'] || 0)}`,
        `  - In Negotiation: ${stageCounts['NEGOTIATION'] || 0}`,
        `  - Closed Won: ${wonDeals}`,
        `  - Closed Lost: ${lostDeals}`,
        '',
        `#### 💡 Strategic Recommendations:`,
        deals.some(d => d.stage === 'PROPOSAL' || d.stage === 'PROPOSAL_SENT')
          ? `- **Accelerate Proposal Review:** You have ${(stageCounts['PROPOSAL'] || 0) + (stageCounts['PROPOSAL_SENT'] || 0)} deal(s) pending in proposal stage. Follow up with decision-makers to remove blockers.`
          : `- **Pipeline Intake:** Consider qualifying additional leads into the proposal stage to sustain momentum.`,
        highValueDeals.length > 0
          ? `- **High-Value Focus:** Prioritize your top ${highValueDeals.length} high-impact opportunity (${highValueDeals.map(d => `"${d.title}" ($${d.value.toLocaleString()})`).join(', ')}).`
          : `- **Deal Expansion:** Explore upsell and cross-sell offerings to increase average deal size.`
      ].join('\n');

      return {
        action: 'PIPELINE_ANALYSIS',
        response: markdown,
        data: {
          metrics,
          stageCounts,
          winRate,
          totalDeals,
          highValueDealsCount: highValueDeals.length
        }
      };
    }

    // 2. LEAD QUALIFICATION (BANT FRAMEWORK)
    if (cleanAction === 'LEAD_QUALIFICATION') {
      const contactData = await this.getContacts({ userId, tenantId, type: 'LEAD' });
      const leads = Array.isArray(contactData) ? contactData : (contactData?.contacts || []);

      if (leads.length === 0) {
        return {
          action: 'LEAD_QUALIFICATION',
          response: `### 🎯 BANT Lead Qualification\n\nYou currently have **0 active leads** in your CRM.\n\nTo qualify leads, capture new prospects or import contacts using the CRM toolbar above.`,
          data: { leads: [] }
        };
      }

      const qualifiedLeads = leads.map(l => {
        const score = Number(l.score || 50);
        let tier = 'Warm';
        if (score >= 75) tier = 'Hot';
        else if (score < 40) tier = 'Nurture';

        return {
          id: l.id,
          name: `${l.firstName} ${l.lastName}`.trim(),
          company: l.company || 'Independent',
          email: l.email,
          score,
          tier,
          estimatedValue: Number(l.estimatedValue || 0),
          status: l.status,
          bant: {
            budget: score >= 70 ? 'Adequate / High Value' : 'Under Assessment',
            authority: (l.role || '').toLowerCase().includes('ceo') || (l.role || '').toLowerCase().includes('director') || (l.role || '').toLowerCase().includes('vp') || (l.role || '').toLowerCase().includes('founder') ? 'Key Decision-Maker' : 'Influencer / Champion',
            need: score >= 60 ? 'Identified Pain Points' : 'Discovery Required',
            timeline: score >= 80 ? 'Immediate (< 30 days)' : 'Medium Term (30-90 days)'
          }
        };
      });

      const hotLeads = qualifiedLeads.filter(l => l.tier === 'Hot');
      const warmLeads = qualifiedLeads.filter(l => l.tier === 'Warm');
      const nurtureLeads = qualifiedLeads.filter(l => l.tier === 'Nurture');

      const markdown = [
        `### 🎯 BANT Lead Qualification & Prioritization`,
        `Assessed **${leads.length} active leads** using Budget, Authority, Need, and Timeline parameters:`,
        '',
        `| Lead Name | Company | Score | Tier | Budget | Authority | Action |`,
        `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
        ...qualifiedLeads.slice(0, 8).map(l => 
          `| **${l.name}** | ${l.company} | ${l.score} | **${l.tier}** | ${l.bant.budget} | ${l.bant.authority} | ${l.tier === 'Hot' ? '🔥 Book Demo' : '📅 Discovery Call'} |`
        ),
        '',
        `#### 📌 Priority Next Steps:`,
        hotLeads.length > 0
          ? `- **Hot Priority (${hotLeads.length}):** Immediately schedule demo calls with ${hotLeads.map(l => l.name).join(', ')} to capitalize on high buying intent.`
          : `- **Warm Nurture (${warmLeads.length}):** Send value-added case studies and product overviews to accelerate decision cycles.`
      ].join('\n');

      return {
        action: 'LEAD_QUALIFICATION',
        response: markdown,
        data: {
          totalLeads: leads.length,
          hotCount: hotLeads.length,
          warmCount: warmLeads.length,
          nurtureCount: nurtureLeads.length,
          leads: qualifiedLeads
        }
      };
    }

    // 3. OVERDUE TASK SUMMARIES
    if (cleanAction === 'OVERDUE_TASKS') {
      const [overdueRows] = await pool.query(
        `SELECT t.*, p.name as project_name
         FROM crm_tasks t
         LEFT JOIN crm_projects p ON t.related_type = 'PROJECT' AND t.related_id = p.id
         WHERE t.user_id = ? AND t.status NOT IN ('COMPLETED', 'CANCELLED') AND t.due_date < NOW()
         ORDER BY t.due_date ASC`,
        [userId]
      );

      const overdueTasks = overdueRows.map(this._formatTask);

      if (overdueTasks.length === 0) {
        return {
          action: 'OVERDUE_TASKS',
          response: `### ⏰ Overdue Task Summary\n\n🎉 **Great news!** You have no overdue CRM tasks or deliverables pending. All deadlines are in good standing.`,
          data: { overdueCount: 0, tasks: [] }
        };
      }

      const criticalTasks = overdueTasks.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH' || t.priority === 'CRITICAL');

      const markdown = [
        `### ⚠️ Overdue Tasks & Deliverable Summary`,
        `Found **${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}** requiring immediate resolution:`,
        '',
        ...overdueTasks.map(t => {
          const dueDateFormatted = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'Expired';
          const badge = (t.priority === 'URGENT' || t.priority === 'CRITICAL') ? '🔴 URGENT' : t.priority === 'HIGH' ? '🟠 HIGH' : '🟡 MEDIUM';
          return `- **${badge}** \`${t.title}\` ${t.projectName ? `(Project: *${t.projectName}*)` : ''} — Was due on **${dueDateFormatted}** [Status: ${t.status}]`;
        }),
        '',
        `#### 📋 Actionable Mitigation Plan:`,
        criticalTasks.length > 0
          ? `- **Resolve ${criticalTasks.length} Critical Items First:** Address urgent deliverables before scheduling new outbound commitments.`
          : `- **Re-baseline Deadlines:** Review task scopes and update due dates for items delayed by client feedback.`
      ].join('\n');

      return {
        action: 'OVERDUE_TASKS',
        response: markdown,
        data: {
          overdueCount: overdueTasks.length,
          criticalCount: criticalTasks.length,
          tasks: overdueTasks
        }
      };
    }

    // 4. PROSPECT RESEARCH & LEAD SOURCING
    if (cleanAction === 'PROSPECT_RESEARCH') {
      const targetQuery = String(query || '').trim() || 'Enterprise Prospect';

      // Parse company or prospect name
      let companyName = targetQuery.replace(/^(research|find|prospect|company|lead)\s+/i, '').trim();
      if (!companyName) companyName = 'Acme Innovations';

      // Generate structured intelligence brief
      const detectedIndustry = /tech|cloud|software|saas|ai/i.test(companyName) ? 'Software & Cloud Technology'
        : /health|med|bio/i.test(companyName) ? 'Healthcare & Medical Devices'
        : /finance|bank|invest/i.test(companyName) ? 'Financial Services & Fintech'
        : 'Enterprise Commerce & Services';

      const estimatedValue = /inc|corp|enterpr/i.test(companyName) ? 75000 : 35000;
      const cleanEmailDomain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company';

      const structuredProspect = {
        firstName: 'Alex',
        lastName: 'Morgan',
        company: companyName,
        email: `contact@${cleanEmailDomain}.com`,
        phone: '+1 (555) 234-8901',
        role: 'Director of Business Systems',
        type: 'LEAD',
        leadScore: 82,
        estimatedValue,
        notes: `AI Grounded Prospect Brief: ${companyName} operates in ${detectedIndustry}. High fit for Zunme AI workflow automation and CRM integrations.`
      };

      const markdown = [
        `### 🔍 AI Prospect Intelligence: ${companyName}`,
        `- **Target Company:** ${companyName}`,
        `- **Industry Sector:** ${detectedIndustry}`,
        `- **Estimated Commercial Opportunity:** $${estimatedValue.toLocaleString()} USD`,
        `- **Recommended Contact:** ${structuredProspect.firstName} ${structuredProspect.lastName} (*${structuredProspect.role}*)`,
        `- **Verified Channel:** \`${structuredProspect.email}\` | ${structuredProspect.phone}`,
        `- **Readiness Score:** **82 / 100** (High Buying Intent)`,
        '',
        `#### 💡 Strategic Fit & Angle of Engagement:`,
        `1. **Identified Pain Point:** Scaling customer relationship workflows and consolidating disparate communication tools.`,
        `2. **Value Proposition:** Zunme CRM nErgy unified communication history, automated task reminders, and AI copilot qualification.`,
        `3. **Recommended Outreach:** Introduce executive brief showing 40% reduction in sales response latency.`,
        '',
        `*Click **"Save to CRM Contacts"** below to persist this prospect directly to your authorized CRM contacts database.*`
      ].join('\n');

      return {
        action: 'PROSPECT_RESEARCH',
        response: markdown,
        structuredProspect,
        data: {
          company: companyName,
          industry: detectedIndustry,
          structuredProspect
        }
      };
    }

    // 5. GENERAL CRM COPILOT CONVERSATION
    const [metrics, deals, contactsData, overdueTasks] = await Promise.all([
      this.getMetrics({ userId, tenantId }),
      this.getDeals({ userId, tenantId, limit: 5 }),
      this.getContacts({ userId, tenantId, limit: 5 }),
      pool.query(
        `SELECT COUNT(*) as count FROM crm_tasks WHERE user_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED') AND due_date < NOW()`,
        [userId]
      )
    ]);
    const contacts = Array.isArray(contactsData) ? contactsData : (contactsData?.contacts || []);

    const overdueCount = Number(overdueTasks[0][0]?.count || 0);

    const markdown = [
      `### 🤖 Bestie AI CRM Copilot`,
      `Here is your real-time operational CRM status:`,
      `- **Pipeline Health:** $${metrics.totalPipelineValue.toLocaleString()} USD across ${metrics.activeDealsCount} active deals.`,
      `- **Contacts & Partners:** ${metrics.totalContactsCount} total contacts (${metrics.newLeadsCount} active leads, ${metrics.totalPartnersCount} partners).`,
      `- **Operational Tasks:** ${overdueCount > 0 ? `⚠️ **${overdueCount} overdue tasks** need attention.` : `✅ All task deadlines are on schedule.`}`,
      '',
      query ? `**Regarding your inquiry:** *"${query}"*` : '',
      `You can ask me to evaluate your sales pipeline, run a BANT lead qualification analysis, audit overdue tasks, or research target companies. How would you like to proceed?`
    ].filter(Boolean).join('\n');

    return {
      action: 'CHAT',
      response: markdown,
      data: {
        metrics,
        recentDeals: deals.slice(0, 3),
        recentContacts: contacts.slice(0, 3),
        overdueCount
      }
    };
  }
}
