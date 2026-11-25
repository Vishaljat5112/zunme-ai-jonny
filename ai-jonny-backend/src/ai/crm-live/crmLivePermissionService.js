/**
 * CRM nErgy Live Data Permission Service
 * Enforces authoritative Role-Based Access Control (RBAC) and Multi-Tenant Isolation
 * mirroring CRM nErgy backend security policies.
 */
export class CrmLivePermissionService {
  static ROLE_PERMISSIONS = {
    SUPER_ADMIN: ['*'],
    BUSINESS_OWNER: [
      'leads:read', 'deals:read', 'tasks:read', 'invoices:read', 'contacts:read', 'dashboard:read',
      'leads:create', 'deals:update', 'tasks:create'
    ],
    OPERATIONS_SALES_ADMIN: [
      'leads:read', 'deals:read', 'tasks:read', 'invoices:read', 'contacts:read', 'dashboard:read',
      'leads:create', 'deals:update', 'tasks:create'
    ],
    FINANCE_COMPLIANCE_ADMIN: [
      'invoices:read', 'deals:read', 'tasks:read', 'dashboard:read'
    ],
    CRM_PRO: [
      'leads:read', 'deals:read', 'tasks:read', 'contacts:read', 'dashboard:read',
      'leads:create', 'deals:update', 'tasks:create'
    ],
    AI_MARKETING_PRO: [
      'leads:read', 'tasks:read', 'contacts:read', 'dashboard:read'
    ],
    AFFILIATE_PARTNER: [
      'deals:read_assigned', 'tasks:read_assigned'
    ],
    HR: [
      'tasks:read'
    ],
    CONTENT_CREATOR: [
      'tasks:read_assigned'
    ],
    CONTENT_BUILDER: [
      'tasks:read_assigned'
    ],
    INFLUENCER: [
      'tasks:read_assigned'
    ],
    CUSTOMER: [
      'tasks:read_customer', 'contacts:read_customer'
    ]
  };

  /**
   * Evaluates if user is authorized to perform action on resource.
   * @param {Object} userContext { userId, tenantId, role }
   * @param {string} permission e.g. 'leads:read', 'invoices:read'
   * @returns {{ authorized: boolean, reason?: string, scopedUserId?: string }}
   */
  static checkPermission(userContext, permission) {
    if (!userContext || !userContext.tenantId) {
      return {
        authorized: false,
        reason: 'Tenant isolation check failed: No tenantId associated with user session.'
      };
    }

    const role = userContext.role || 'GUEST';
    const permissions = this.ROLE_PERMISSIONS[role] || [];

    // Master Super Admin Override
    if (permissions.includes('*') || role === 'SUPER_ADMIN') {
      return { authorized: true };
    }

    // Direct permission match
    if (permissions.includes(permission)) {
      return { authorized: true };
    }

    // Scoped permissions (e.g. read assigned only)
    const assignedPerm = `${permission}_assigned`;
    if (permissions.includes(assignedPerm)) {
      return {
        authorized: true,
        scopedUserId: userContext.userId,
        reason: 'Authorized for self-assigned records only.'
      };
    }

    const customerPerm = `${permission}_customer`;
    if (permissions.includes(customerPerm)) {
      return {
        authorized: true,
        scopedUserId: userContext.userId,
        reason: 'Authorized for personal account records only.'
      };
    }

    return {
      authorized: false,
      reason: `Access Denied: Role '${role}' is not authorized to access '${permission}'.`
    };
  }

  /**
   * Validates tool execution request against active user context.
   * @param {string} toolName
   * @param {Object} userContext
   */
  static validateToolAccess(toolName, userContext) {
    const toolPermissionMap = {
      getLeadCount: 'leads:read',
      getMyAssignedLeads: 'leads:read',
      getLeadDetails: 'leads:read',
      getDealPipelineSummary: 'deals:read',
      getPipelineValue: 'deals:read',
      getOverdueTasks: 'tasks:read',
      getPendingInvoices: 'invoices:read',
      getContactDetails: 'contacts:read',
      getDashboardSummary: 'dashboard:read'
    };

    const requiredPermission = toolPermissionMap[toolName];
    if (!requiredPermission) {
      return {
        authorized: false,
        reason: `Unknown live tool '${toolName}'. Execution prevented.`
      };
    }

    return this.checkPermission(userContext, requiredPermission);
  }
}

