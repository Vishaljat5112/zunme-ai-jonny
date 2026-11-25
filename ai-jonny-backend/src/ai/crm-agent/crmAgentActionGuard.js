import { CrmLivePermissionService } from '../crm-live/crmLivePermissionService.js';

/**
 * CRM nErgy Agent Action Guard
 * Enforces rigorous security boundaries:
 * 1. RBAC and tenant authorization via CrmLivePermissionService
 * 2. Strict input validation and SQL injection prevention
 * 3. Future write action governance: All mutations require explicit confirmation
 * 4. Action audit logging
 */
export class CrmAgentActionGuard {
  // Registry of supported future write actions (disabled by default until explicitly confirmed)
  static WRITE_ACTION_REGISTRY = {
    createLead: {
      permission: 'leads:create',
      requiresConfirmation: true,
      description: 'Create a new prospective lead in CRM nErgy',
      schema: {
        name: { type: 'string', required: true },
        company: { type: 'string', required: true },
        estimatedValue: { type: 'number', required: false }
      }
    },
    updateDealStage: {
      permission: 'deals:update',
      requiresConfirmation: true,
      description: 'Transition deal to next stage in sales pipeline',
      schema: {
        dealId: { type: 'string', required: true },
        stage: { type: 'string', required: true }
      }
    },
    createTask: {
      permission: 'tasks:create',
      requiresConfirmation: true,
      description: 'Assign a new follow-up task',
      schema: {
        title: { type: 'string', required: true },
        dueDate: { type: 'string', required: true }
      }
    }
  };

  /**
   * Sanitizes input arguments to prevent arbitrary SQL fragments or malicious injections.
   * @param {Object} args
   */
  static sanitizeArgs(args) {
    if (!args || typeof args !== 'object') return {};

    const clean = {};
    for (const [key, val] of Object.entries(args)) {
      if (typeof val === 'string') {
        // Disallow dangerous SQL control syntax in text arguments
        const sanitized = val
          .replace(/[;'"]+/g, '')
          .replace(/\b(UNION|DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|EXEC|GRANT)\b/gi, '')
          .trim();
        clean[key] = sanitized;
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        clean[key] = val;
      } else if (val === null || val === undefined) {
        clean[key] = val;
      }
    }
    return clean;
  }

  /**
   * Evaluates if a planned tool or action is safe and permitted to execute.
   * @param {string} actionName
   * @param {Object} userContext
   * @param {Object} args
   * @param {boolean} userConfirmed Whether user has already confirmed the action
   */
  static validateAction(actionName, userContext, args = {}, userConfirmed = false) {
    if (!userContext || !userContext.tenantId) {
      return {
        allowed: false,
        reason: 'Action Guard: Missing tenantId. Multi-tenant isolation violation prevented.',
        action: actionName
      };
    }

    // 1. Check if it's a registered read-only tool
    const readCheck = CrmLivePermissionService.validateToolAccess(actionName, userContext);
    if (readCheck.authorized) {
      return {
        allowed: true,
        sanitizedArgs: this.sanitizeArgs(args),
        isWriteAction: false,
        action: actionName
      };
    }

    // 2. Check if it's a registered write action
    const writeDef = this.WRITE_ACTION_REGISTRY[actionName];
    if (writeDef) {
      // Permission check for write action
      const permCheck = CrmLivePermissionService.checkPermission(userContext, writeDef.permission);
      if (!permCheck.authorized) {
        return {
          allowed: false,
          reason: `Action Guard: Role '${userContext.role}' lacks permission '${writeDef.permission}'.`,
          action: actionName
        };
      }

      // Confirmation gate for write action
      if (writeDef.requiresConfirmation && !userConfirmed) {
        return {
          allowed: false,
          requiresConfirmation: true,
          confirmationDetails: {
            action: actionName,
            description: writeDef.description,
            parameters: this.sanitizeArgs(args)
          },
          reason: `Confirmation Required: Action '${actionName}' modifies CRM data and requires explicit user confirmation.`,
          action: actionName
        };
      }

      return {
        allowed: true,
        sanitizedArgs: this.sanitizeArgs(args),
        isWriteAction: true,
        action: actionName
      };
    }

    // 3. Reject any unapproved arbitrary tool or raw execution
    return {
      allowed: false,
      reason: `Action Guard: Action '${actionName}' is not an approved CRM tool. Execution blocked.`,
      action: actionName
    };
  }

  /**
   * Action audit logging for compliance and governance
   */
  static logAuditEvent(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: event.action,
      tenantId: event.tenantId,
      userId: event.userId,
      role: event.role,
      status: event.status,
      reason: event.reason || null
    };
    // Safe non-blocking log output
    console.log(`[CRM AGENT AUDIT] ${JSON.stringify(logEntry)}`);
    return logEntry;
  }
}

