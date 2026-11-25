import { CrmLiveToolRegistry } from '../crm-live/crmLiveToolRegistry.js';
import { CrmAgentActionGuard } from './crmAgentActionGuard.js';

/**
 * CRM nErgy Agent Executor
 * Executes planned tool steps in sequence with Action Guard enforcement,
 * parameter sanitation, tenant isolation, and audit logging.
 */
export class CrmAgentExecutor {
  static MAX_STEPS = 3;

  /**
   * Executes an agent execution plan safely.
   * @param {Object} plan { goal, steps: [{ tool, args }] }
   * @param {Object} userContext { userId, tenantId, role }
   */
  static async executePlan(plan, userContext) {
    if (!plan || !Array.isArray(plan.steps)) {
      throw new Error('CrmAgentExecutor: Invalid plan structure provided.');
    }

    const stepsToRun = plan.steps.slice(0, this.MAX_STEPS);
    const executionTrace = [];
    const results = {};
    const guardsEnforced = [];
    const toolsExecuted = [];

    for (const step of stepsToRun) {
      const stepStart = performance.now();
      const toolName = step.tool;
      const rawArgs = step.args || {};

      // 1. Pass through Action Guard
      const guardCheck = CrmAgentActionGuard.validateAction(toolName, userContext, rawArgs);

      if (!guardCheck.allowed) {
        CrmAgentActionGuard.logAuditEvent({
          action: toolName,
          tenantId: userContext?.tenantId,
          userId: userContext?.userId,
          role: userContext?.role,
          status: guardCheck.requiresConfirmation ? 'CONFIRMATION_REQUIRED' : 'BLOCKED',
          reason: guardCheck.reason
        });

        guardsEnforced.push({
          tool: toolName,
          reason: guardCheck.reason,
          requiresConfirmation: Boolean(guardCheck.requiresConfirmation),
          confirmationDetails: guardCheck.confirmationDetails || null
        });

        executionTrace.push({
          tool: toolName,
          status: guardCheck.requiresConfirmation ? 'CONFIRMATION_REQUIRED' : 'BLOCKED',
          durationMs: Math.round(performance.now() - stepStart),
          reason: guardCheck.reason
        });

        // Skip to next step if blocked
        continue;
      }

      // 2. Execute approved tool via Live Tool Registry
      try {
        const toolResult = await CrmLiveToolRegistry.executeTool(
          toolName,
          userContext,
          guardCheck.sanitizedArgs
        );

        const durationMs = Math.round(performance.now() - stepStart);

        if (toolResult.success) {
          toolsExecuted.push(toolName);
          results[toolName] = toolResult.data;

          CrmAgentActionGuard.logAuditEvent({
            action: toolName,
            tenantId: userContext.tenantId,
            userId: userContext.userId,
            role: userContext.role,
            status: 'SUCCESS'
          });

          executionTrace.push({
            tool: toolName,
            status: 'SUCCESS',
            durationMs
          });
        } else {
          executionTrace.push({
            tool: toolName,
            status: 'FAILED',
            error: toolResult.error,
            durationMs
          });
        }
      } catch (err) {
        executionTrace.push({
          tool: toolName,
          status: 'ERROR',
          error: err.message,
          durationMs: Math.round(performance.now() - stepStart)
        });
      }
    }

    return {
      success: toolsExecuted.length > 0,
      goal: plan.goal,
      toolsExecuted,
      results,
      guardsEnforced,
      executionTrace
    };
  }
}

