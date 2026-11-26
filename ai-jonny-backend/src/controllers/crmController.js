import { CrmService } from '../services/crmService.js';

export class CrmController {
  /**
   * Helper to extract verified authentication context.
   * Never relies on client-supplied ownership fields.
   */
  static _getUserContext(req) {
    if (req.user?.isGuest || !req.user?.id) {
      return null;
    }
    return {
      userId: req.user.id,
      tenantId: req.user.tenantId || 'global',
      role: req.user.role || 'USER'
    };
  }

  // ==========================================================================
  // METRICS
  // ==========================================================================

  static async getMetrics(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const metrics = await CrmService.getMetrics({
        userId: auth.userId,
        tenantId: auth.tenantId
      });

      return res.status(200).json({ success: true, metrics });
    } catch (err) {
      console.error('[CrmController] getMetrics error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ==========================================================================
  // CONTACTS & PARTNERS
  // ==========================================================================

  static async getContacts(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { type, status, search, limit, offset } = req.query;
      const result = await CrmService.getContacts({
        userId: auth.userId,
        tenantId: auth.tenantId,
        type,
        status,
        search,
        limit,
        offset
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[CrmController] getContacts error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getContactById(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const contact = await CrmService.getContactById({
        userId: auth.userId,
        tenantId: auth.tenantId,
        contactId: id
      });

      if (!contact) {
        return res.status(404).json({ success: false, error: 'Contact not found or access denied.' });
      }

      return res.status(200).json({ success: true, contact });
    } catch (err) {
      console.error('[CrmController] getContactById error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createContact(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        company,
        jobTitle,
        type,
        status,
        score,
        source,
        estimatedValue,
        partnerTier,
        notes
      } = req.body;

      const contact = await CrmService.createContact({
        userId: auth.userId,
        tenantId: auth.tenantId,
        firstName,
        lastName,
        email,
        phone,
        company,
        jobTitle,
        type,
        status,
        score,
        source,
        estimatedValue,
        partnerTier,
        notes
      });

      return res.status(201).json({ success: true, contact });
    } catch (err) {
      console.error('[CrmController] createContact error:', err.message);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async bulkImportContacts(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { contacts } = req.body;
      const result = await CrmService.bulkImportContacts({
        userId: auth.userId,
        tenantId: auth.tenantId,
        contacts
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[CrmController] bulkImportContacts error:', err.message);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateContact(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const contact = await CrmService.updateContact({
        userId: auth.userId,
        tenantId: auth.tenantId,
        contactId: id,
        updates: req.body
      });

      return res.status(200).json({ success: true, contact });
    } catch (err) {
      console.error('[CrmController] updateContact error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async deleteContact(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const result = await CrmService.deleteContact({
        userId: auth.userId,
        tenantId: auth.tenantId,
        contactId: id
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[CrmController] deleteContact error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  // ==========================================================================
  // DEALS & SALES PIPELINE
  // ==========================================================================

  static async getDeals(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { stage, contactId, limit, offset } = req.query;
      const deals = await CrmService.getDeals({
        userId: auth.userId,
        tenantId: auth.tenantId,
        stage,
        contactId,
        limit,
        offset
      });

      return res.status(200).json({ success: true, deals, count: deals.length });
    } catch (err) {
      console.error('[CrmController] getDeals error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getDealById(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const deal = await CrmService.getDealById({
        userId: auth.userId,
        tenantId: auth.tenantId,
        dealId: id
      });

      if (!deal) {
        return res.status(404).json({ success: false, error: 'Deal not found or access denied.' });
      }

      return res.status(200).json({ success: true, deal });
    } catch (err) {
      console.error('[CrmController] getDealById error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createDeal(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { contactId, title, value, currency, stage, probability, expectedCloseDate, notes } = req.body;
      const deal = await CrmService.createDeal({
        userId: auth.userId,
        tenantId: auth.tenantId,
        contactId,
        title,
        value,
        currency,
        stage,
        probability,
        expectedCloseDate,
        notes
      });

      return res.status(201).json({ success: true, deal });
    } catch (err) {
      console.error('[CrmController] createDeal error:', err.message);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateDealStage(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const { stage } = req.body;

      if (!stage) {
        return res.status(400).json({ success: false, error: 'New deal stage is required.' });
      }

      const deal = await CrmService.updateDealStage({
        userId: auth.userId,
        tenantId: auth.tenantId,
        dealId: id,
        stage
      });

      return res.status(200).json({ success: true, deal });
    } catch (err) {
      console.error('[CrmController] updateDealStage error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async updateDeal(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const deal = await CrmService.updateDeal({
        userId: auth.userId,
        tenantId: auth.tenantId,
        dealId: id,
        updates: req.body
      });

      return res.status(200).json({ success: true, deal });
    } catch (err) {
      console.error('[CrmController] updateDeal error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async deleteDeal(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const result = await CrmService.deleteDeal({
        userId: auth.userId,
        tenantId: auth.tenantId,
        dealId: id
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[CrmController] deleteDeal error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  // ==========================================================================
  // ACTIVITIES & COMMUNICATION HISTORY
  // ==========================================================================

  static async getActivities(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { contactId, dealId, activityType, limit, offset } = req.query;
      const activities = await CrmService.getActivities({
        userId: auth.userId,
        tenantId: auth.tenantId,
        contactId,
        dealId,
        activityType,
        limit,
        offset
      });

      return res.status(200).json({ success: true, activities, count: activities.length });
    } catch (err) {
      console.error('[CrmController] getActivities error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createActivity(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { contactId, dealId, activityType, title, description } = req.body;
      const activity = await CrmService.createActivity({
        userId: auth.userId,
        tenantId: auth.tenantId,
        contactId,
        dealId,
        activityType,
        title,
        description
      });

      return res.status(201).json({ success: true, activity });
    } catch (err) {
      console.error('[CrmController] createActivity error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async deleteActivity(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const result = await CrmService.deleteActivity({
        userId: auth.userId,
        tenantId: auth.tenantId,
        activityId: id
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[CrmController] deleteActivity error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  // ==========================================================================
  // PROJECTS & DELIVERY
  // ==========================================================================

  static async getProjects(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { status, dealId, limit, offset } = req.query;
      const projects = await CrmService.getProjects({
        userId: auth.userId,
        tenantId: auth.tenantId,
        status,
        dealId,
        limit,
        offset
      });

      return res.status(200).json({ success: true, projects, count: projects.length });
    } catch (err) {
      console.error('[CrmController] getProjects error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getProjectById(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const project = await CrmService.getProjectById({
        userId: auth.userId,
        tenantId: auth.tenantId,
        projectId: id
      });

      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found or access denied.' });
      }

      return res.status(200).json({ success: true, project });
    } catch (err) {
      console.error('[CrmController] getProjectById error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createProject(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { dealId, name, category, status, progress, dueDate, description } = req.body;
      const project = await CrmService.createProject({
        userId: auth.userId,
        tenantId: auth.tenantId,
        dealId,
        name,
        category,
        status,
        progress,
        dueDate,
        description
      });

      return res.status(201).json({ success: true, project });
    } catch (err) {
      console.error('[CrmController] createProject error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async updateProject(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const project = await CrmService.updateProject({
        userId: auth.userId,
        tenantId: auth.tenantId,
        projectId: id,
        updates: req.body
      });

      return res.status(200).json({ success: true, project });
    } catch (err) {
      console.error('[CrmController] updateProject error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async deleteProject(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const result = await CrmService.deleteProject({
        userId: auth.userId,
        tenantId: auth.tenantId,
        projectId: id
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[CrmController] deleteProject error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async convertDealToProject(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const { projectName, category, dueDate, description } = req.body || {};

      const project = await CrmService.convertDealToProject({
        userId: auth.userId,
        tenantId: auth.tenantId,
        dealId: id,
        projectName,
        category,
        dueDate,
        description
      });

      return res.status(201).json({ success: true, project });
    } catch (err) {
      console.error('[CrmController] convertDealToProject error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  // ==========================================================================
  // TASKS & ACTION REMINDERS
  // ==========================================================================

  static async getTasks(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { relatedType, relatedId, status, limit, offset } = req.query;
      const tasks = await CrmService.getTasks({
        userId: auth.userId,
        tenantId: auth.tenantId,
        relatedType,
        relatedId,
        status,
        limit,
        offset
      });

      return res.status(200).json({ success: true, tasks, count: tasks.length });
    } catch (err) {
      console.error('[CrmController] getTasks error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createTask(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { relatedType, relatedId, title, priority, status, dueDate } = req.body;
      const task = await CrmService.createTask({
        userId: auth.userId,
        tenantId: auth.tenantId,
        relatedType,
        relatedId,
        title,
        priority,
        status,
        dueDate
      });

      return res.status(201).json({ success: true, task });
    } catch (err) {
      console.error('[CrmController] createTask error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async updateTask(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const task = await CrmService.updateTask({
        userId: auth.userId,
        tenantId: auth.tenantId,
        taskId: id,
        updates: req.body
      });

      return res.status(200).json({ success: true, task });
    } catch (err) {
      console.error('[CrmController] updateTask error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  static async deleteTask(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { id } = req.params;
      const result = await CrmService.deleteTask({
        userId: auth.userId,
        tenantId: auth.tenantId,
        taskId: id
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[CrmController] deleteTask error:', err.message);
      const isNotFound = err.message && (err.message.includes('not found') || err.message.includes('access denied'));
      return res.status(isNotFound ? 404 : 400).json({ success: false, error: err.message });
    }
  }

  // ==========================================================================
  // MODULE AVAILABILITY, ADMIN TELEMETRY & AI COPILOT
  // ==========================================================================

  /**
   * Middleware to verify whether the CRM nErgy module is globally enabled.
   * Super Admins and Admins retain operational bypass access.
   */
  static async checkModuleEnabled(req, res, next) {
    try {
      const enabled = await CrmService.isModuleEnabled();
      if (!enabled) {
        const userRole = req.user?.role;
        if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
          return res.status(403).json({
            success: false,
            error: 'CRM nErgy module is currently disabled by administrator.'
          });
        }
      }
      return next();
    } catch (err) {
      console.warn('[CrmController] checkModuleEnabled error, passing through:', err.message);
      return next();
    }
  }

  /**
   * GET /api/crm/status
   * Returns current module availability status.
   */
  static async getStatus(req, res) {
    try {
      const enabled = await CrmService.isModuleEnabled();
      return res.status(200).json({
        success: true,
        enabled,
        module: 'CRM nErgy'
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/admin/crm/settings
   * Returns module toggle state.
   */
  static async getSettings(req, res) {
    try {
      const enabled = await CrmService.isModuleEnabled();
      return res.status(200).json({ success: true, enabled });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/admin/crm/settings
   * Toggles CRM module enabled state.
   */
  static async updateSettings(req, res) {
    try {
      const { enabled } = req.body;
      const actorName = req.user?.name || req.user?.fullName || 'SuperAdmin';
      const result = await CrmService.updateModuleSettings({ enabled, actorName });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/admin/crm/stats
   * Returns platform-wide aggregate CRM usage telemetry.
   * Scoped strictly to Admin and Super Admin roles.
   */
  static async getAdminStats(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, error: 'Forbidden: Admin access required.' });
      }

      const stats = await CrmService.getAdminStats();
      return res.status(200).json({ success: true, stats });
    } catch (err) {
      console.error('[CrmController] getAdminStats error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/crm/ai/copilot
   * Bestie AI CRM Copilot: pipeline health, BANT qualification, overdue tasks, prospect research.
   */
  static async copilotChat(req, res) {
    try {
      const auth = CrmController._getUserContext(req);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
      }

      const { action = 'CHAT', query = '', context = {} } = req.body;
      const result = await CrmService.getCopilotInsights({
        userId: auth.userId,
        tenantId: auth.tenantId,
        action,
        query,
        context
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[CrmController] copilotChat error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
