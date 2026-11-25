/**
 * Kiaan AI Software Registry
 * Central repository of registered software ecosystems, their agent adapters,
 * knowledge sources, and operational statuses.
 */
export const SOFTWARE_STATUS = {
  ACTIVE: 'ACTIVE',
  PENDING_AGENT: 'PENDING_AGENT',
  KNOWLEDGE_READY: 'KNOWLEDGE_READY',
  INACTIVE: 'INACTIVE'
};

export class SoftwareRegistry {
  static registry = new Map();

  /**
   * Registers a new software definition.
   */
  static register(software) {
    if (!software.softwareId || !software.softwareName) {
      throw new Error('SoftwareRegistry: softwareId and softwareName are required.');
    }
    this.registry.set(software.softwareId.toLowerCase(), {
      softwareId: software.softwareId.toLowerCase(),
      softwareName: software.softwareName,
      description: software.description || '',
      aliases: (software.aliases || []).map((a) => a.toLowerCase()),
      knowledgeSource: software.knowledgeSource || null,
      knowledgeStatus: software.knowledgeStatus || (software.knowledgeSource ? 'KNOWLEDGE_PUBLISHED' : 'KNOWLEDGE_PENDING'),
      agentStatus: software.agentStatus || (software.status === SOFTWARE_STATUS.ACTIVE ? 'ACTIVE' : 'AGENT_PENDING'),
      agentConfig: software.agentConfig || null,
      enabledTools: software.enabledTools || [],
      permissionRequirements: software.permissionRequirements || [],
      status: software.status || SOFTWARE_STATUS.PENDING_AGENT
    });
  }

  /**
   * Updates knowledge lifecycle status for a software ecosystem.
   */
  static updateKnowledgeStatus(softwareId, knowledgeStatus) {
    const sw = this.getSoftware(softwareId);
    if (sw) {
      sw.knowledgeStatus = knowledgeStatus;
      return true;
    }
    return false;
  }

  /**
   * Updates published knowledge source for a software ecosystem.
   */
  static updateKnowledgeSource(softwareId, knowledgeSource) {
    const sw = this.getSoftware(softwareId);
    if (sw) {
      sw.knowledgeSource = knowledgeSource;
      sw.knowledgeStatus = 'KNOWLEDGE_PUBLISHED';
      return true;
    }
    return false;
  }

  /**
   * Retrieves a registered software by exact ID.
   */
  static getSoftware(softwareId) {
    if (!softwareId) return null;
    return this.registry.get(String(softwareId).toLowerCase()) || null;
  }

  /**
   * Finds software by name or registered alias.
   */
  static findByAlias(aliasOrName) {
    if (!aliasOrName || typeof aliasOrName !== 'string') return null;
    const clean = aliasOrName.trim().toLowerCase();

    for (const software of this.registry.values()) {
      if (software.softwareId === clean || software.softwareName.toLowerCase() === clean) {
        return software;
      }
      if (software.aliases.includes(clean)) {
        return software;
      }
    }
    return null;
  }

  /**
   * Lists all operational (ACTIVE) software systems.
   */
  static listActiveSoftwares() {
    return Array.from(this.registry.values()).filter(
      (s) => s.status === SOFTWARE_STATUS.ACTIVE
    );
  }

  /**
   * Lists all registered software systems regardless of status.
   */
  static listAllSoftwares() {
    return Array.from(this.registry.values());
  }

  /**
   * Initializes default software registry with verified CRM nErgy and pending systems.
   */
  static initDefaults() {
    this.registry.clear();

    // 1. CRM nErgy — Fully Verified & Active
    this.register({
      softwareId: 'crm-nergy',
      softwareName: 'CRM nErgy Enterprise',
      description: 'Unified Enterprise CRM, Sales Pipeline, ERP, HR, and OAL/OMP Operations',
      aliases: ['crm-nergy', 'crm energy', 'nergy crm', 'nergy', 'crm'],
      knowledgeSource: {
        collection: 'crm_nergy_knowledge',
        directory: 'crm energy knowledge',
        chunkCount: 181
      },
      agentConfig: {
        handler: 'crmAgent',
        capabilities: ['rag', 'live_data', 'multi_tool_agent']
      },
      enabledTools: [
        'getLeadCount',
        'getMyAssignedLeads',
        'getLeadDetails',
        'getDealPipelineSummary',
        'getPipelineValue',
        'getOverdueTasks',
        'getPendingInvoices',
        'getContactDetails',
        'getDashboardSummary'
      ],
      permissionRequirements: ['leads:read', 'deals:read', 'tasks:read', 'invoices:read'],
      status: SOFTWARE_STATUS.ACTIVE
    });

    // 2. ERP Hub — Pending Implementation (Transparently documented)
    this.register({
      softwareId: 'erp-hub',
      softwareName: 'Kiaan ERP Hub',
      description: 'Warehouse Inventory, Supply Chain, and Procurement Management',
      aliases: ['erp-hub', 'erp hub', 'kiaan erp'],
      knowledgeSource: {
        collection: 'erp_hub_knowledge',
        directory: null
      },
      agentConfig: null,
      enabledTools: [],
      status: SOFTWARE_STATUS.PENDING_AGENT
    });

    // 3. HR & ATS System — Pending Implementation
    this.register({
      softwareId: 'hr-ats',
      softwareName: 'Kiaan HR & ATS Hiring Suite',
      description: 'Recruitment, Candidate Tracking, Employee Onboarding and Payroll',
      aliases: ['hr-ats', 'hr ats', 'recruitment portal'],
      knowledgeSource: null,
      agentConfig: null,
      enabledTools: [],
      status: SOFTWARE_STATUS.PENDING_AGENT
    });
  }
}

// Auto-initialize defaults on module load
SoftwareRegistry.initDefaults();

