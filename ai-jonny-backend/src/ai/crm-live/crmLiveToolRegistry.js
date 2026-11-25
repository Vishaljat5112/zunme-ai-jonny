import { CrmLiveDataService } from './crmLiveDataService.js';
import { CrmLivePermissionService } from './crmLivePermissionService.js';

/**
 * CRM nErgy Live Tool Registry
 * Exposes the 9 verified read-only tools with strict validation and permission checks.
 */
export class CrmLiveToolRegistry {
  static tools = {
    getLeadCount: {
      name: 'getLeadCount',
      description: 'Get verified real-time count of leads in CRM (supports filter=all|today, status)',
      parameters: {
        filter: { type: 'string', enum: ['all', 'today'], default: 'all' },
        status: { type: 'string', required: false }
      },
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getLeadCount(userContext, args);
      }
    },

    getMyAssignedLeads: {
      name: 'getMyAssignedLeads',
      description: 'Get verified leads assigned directly to the current authenticated CRM user',
      parameters: {
        limit: { type: 'number', default: 10 }
      },
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getMyAssignedLeads(userContext, args);
      }
    },

    getLeadDetails: {
      name: 'getLeadDetails',
      description: 'Get complete verified profile of a specific lead by ID or name/company search',
      parameters: {
        leadId: { type: 'string', required: false },
        query: { type: 'string', required: false }
      },
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getLeadDetails(userContext, args);
      }
    },

    getDealPipelineSummary: {
      name: 'getDealPipelineSummary',
      description: 'Get breakdown of deals and stage distribution across the 8 sales pipeline stages',
      parameters: {},
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getDealPipelineSummary(userContext);
      }
    },

    getPipelineValue: {
      name: 'getPipelineValue',
      description: 'Get total verified monetary pipeline value across deals and commercial leads',
      parameters: {},
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getPipelineValue(userContext);
      }
    },

    getOverdueTasks: {
      name: 'getOverdueTasks',
      description: 'Get list of pending or in-progress tasks past their due date',
      parameters: {},
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getOverdueTasks(userContext);
      }
    },

    getPendingInvoices: {
      name: 'getPendingInvoices',
      description: 'Get list of outstanding or unpaid invoices requiring collection',
      parameters: {},
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getPendingInvoices(userContext);
      }
    },

    getContactDetails: {
      name: 'getContactDetails',
      description: 'Get verified details of a business contact or customer by ID or search term',
      parameters: {
        contactId: { type: 'string', required: false },
        query: { type: 'string', required: false }
      },
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getContactDetails(userContext, args);
      }
    },

    getDashboardSummary: {
      name: 'getDashboardSummary',
      description: 'Get high-level live operational snapshot across leads, pipeline, tasks, and invoices',
      parameters: {},
      execute: async (userContext, args) => {
        return await CrmLiveDataService.getDashboardSummary(userContext);
      }
    }
  };

  /**
   * Executes a tool by name with security checks.
   * @param {string} toolName
   * @param {Object} userContext
   * @param {Object} args
   */
  static async executeTool(toolName, userContext, args = {}) {
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in CRM Live Registry.`);
    }

    // Permission enforcement
    const authCheck = CrmLivePermissionService.validateToolAccess(toolName, userContext);
    if (!authCheck.authorized) {
      return {
        success: false,
        authorized: false,
        error: authCheck.reason || 'Permission denied.',
        tool: toolName
      };
    }

    try {
      const data = await tool.execute(userContext, args);
      return {
        success: true,
        authorized: true,
        tool: toolName,
        data
      };
    } catch (err) {
      return {
        success: false,
        authorized: true,
        error: err.message,
        tool: toolName
      };
    }
  }

  static getAvailableTools() {
    return Object.values(this.tools).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
  }
}

