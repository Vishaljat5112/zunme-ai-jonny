/**
 * Kiaan AI Software Integration Platform Types & Lifecycle States (Step 10)
 */

export const INTEGRATION_STATUS = {
  INTEGRATION_PENDING: 'INTEGRATION_PENDING',
  CONFIGURED: 'CONFIGURED',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  ERROR: 'ERROR'
};

export const INTEGRATION_TYPE = {
  REST_EMBEDDED: 'REST_EMBEDDED',
  API_CONNECTOR: 'API_CONNECTOR',
  WEBHOOK: 'WEBHOOK'
};

export const INTEGRATION_EVENT_TYPES = {
  AUTHENTICATION_SUCCESS: 'AUTHENTICATION_SUCCESS',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  CONFIG_UPDATE: 'CONFIG_UPDATE',
  TOOL_INVOCATION: 'TOOL_INVOCATION',
  INTEGRATION_ENABLED: 'INTEGRATION_ENABLED',
  INTEGRATION_DISABLED: 'INTEGRATION_DISABLED',
  CHAT_INITIATED: 'CHAT_INITIATED',
  CHAT_COMPLETED: 'CHAT_COMPLETED',
  CHAT_FAILED: 'CHAT_FAILED',
  INTEGRATION_TEST_RUN: 'INTEGRATION_TEST_RUN'
};

/**
 * Pre-configured software integration manifests
 */
export const DEFAULT_SOFTWARE_INTEGRATIONS = [
  {
    softwareId: 'crm-nergy',
    softwareName: 'CRM nErgy Enterprise',
    integrationStatus: INTEGRATION_STATUS.ACTIVE,
    integrationType: INTEGRATION_TYPE.REST_EMBEDDED,
    aiName: 'Bestie AI & CRM Copilot',
    welcomeMessage: 'Hello! I am your CRM nErgy Enterprise AI Copilot. How can I assist with your pipeline, deals, or operations today?',
    systemInstructions: 'You are the official CRM nErgy AI Copilot. Only answer CRM queries using verified CRM documentation and live database tools.',
    allowedTools: [
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
    allowedRoles: ['BUSINESS_OWNER', 'SALES_MANAGER', 'SALES_REP', 'ACCOUNTANT', 'SUPER_ADMIN']
  },
  {
    softwareId: 'erp-hub',
    softwareName: 'Kiaan ERP Hub',
    integrationStatus: INTEGRATION_STATUS.CONFIGURED,
    integrationType: INTEGRATION_TYPE.REST_EMBEDDED,
    aiName: 'ERP Hub Assistant',
    welcomeMessage: 'Welcome to Kiaan ERP Hub AI. I can assist with warehouse inventory, suppliers, and procurement.',
    systemInstructions: 'You are the Kiaan ERP Hub AI. Guide users on warehouse stock levels, PO approvals, and inventory tracking.',
    allowedTools: ['getInventoryStock', 'getPendingPurchaseOrders'],
    allowedRoles: ['WAREHOUSE_MANAGER', 'PROCUREMENT_OFFICER', 'FINANCE_DIRECTOR', 'SUPER_ADMIN']
  },
  {
    softwareId: 'hr-ats',
    softwareName: 'TalentTrack HR & ATS',
    integrationStatus: INTEGRATION_STATUS.INTEGRATION_PENDING,
    integrationType: INTEGRATION_TYPE.REST_EMBEDDED,
    aiName: 'TalentTrack AI',
    welcomeMessage: 'Welcome to TalentTrack. I can help with recruiting pipelines, applicant screening, and employee records.',
    systemInstructions: 'You are the TalentTrack HR AI Assistant. Assist with candidate stages and hiring workflows.',
    allowedTools: ['getCandidatePipeline', 'getJobRequisitions'],
    allowedRoles: ['HR_DIRECTOR', 'RECRUITER', 'HIRING_MANAGER', 'SUPER_ADMIN']
  },
  {
    softwareId: 'omp-deals',
    softwareName: 'OMP Deals Auto Program',
    integrationStatus: INTEGRATION_STATUS.INTEGRATION_PENDING,
    integrationType: INTEGRATION_TYPE.API_CONNECTOR,
    aiName: 'OMP Deals Copilot',
    welcomeMessage: 'Welcome to Nationwide Auto Dealer Program - OMP Deals AI.',
    systemInstructions: 'Assist automotive dealership networks with vehicle inventory, quotes, and dealer discounts.',
    allowedTools: [],
    allowedRoles: ['DEALER_PRINCIPAL', 'SALES_DESK', 'SUPER_ADMIN']
  },
  {
    softwareId: 'swmtp',
    softwareName: 'Secured eBox & SWMTP',
    integrationStatus: INTEGRATION_STATUS.INTEGRATION_PENDING,
    integrationType: INTEGRATION_TYPE.API_CONNECTOR,
    aiName: 'eBox Security Assistant',
    welcomeMessage: 'Secured eBox & SWMTP protocol assistant.',
    systemInstructions: 'Assist with encrypted document dispatch and delivery verification.',
    allowedTools: [],
    allowedRoles: ['SECURITY_ADMIN', 'DISPATCHER']
  },
  {
    softwareId: 'oal',
    softwareName: 'OAL Network Operations',
    integrationStatus: INTEGRATION_STATUS.INTEGRATION_PENDING,
    integrationType: INTEGRATION_TYPE.API_CONNECTOR,
    aiName: 'OAL Operations AI',
    welcomeMessage: 'OAL Network Operations and Help Desk Assistant.',
    systemInstructions: 'Assist with ticketing, SLAs, and technical network dispatch.',
    allowedTools: [],
    allowedRoles: ['NETWORK_OPERATOR', 'SUPPORT_ENGINEER']
  },
  {
    softwareId: 'icanvasspdm',
    softwareName: 'iCanvass PDM Field Suite',
    integrationStatus: INTEGRATION_STATUS.INTEGRATION_PENDING,
    integrationType: INTEGRATION_TYPE.REST_EMBEDDED,
    aiName: 'iCanvass Field AI',
    welcomeMessage: 'iCanvass PDM Field Marketing and Canvassing Assistant.',
    systemInstructions: 'Assist field canvassers with route optimization and lead capture.',
    allowedTools: [],
    allowedRoles: ['CANVASSER', 'TERRITORY_MANAGER']
  },
  {
    softwareId: 'zunme',
    softwareName: 'Zunme & Bestie Video Agent',
    integrationStatus: INTEGRATION_STATUS.INTEGRATION_PENDING,
    integrationType: INTEGRATION_TYPE.API_CONNECTOR,
    aiName: 'Zunme Video Copilot',
    welcomeMessage: 'Zunme and Bestie Video Agent studio copilot.',
    systemInstructions: 'Assist with AI video generation, avatars, and script synthesis.',
    allowedTools: [],
    allowedRoles: ['CREATOR', 'STUDIO_PRODUCER']
  }
];

