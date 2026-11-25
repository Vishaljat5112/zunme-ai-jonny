import { SoftwareRegistry, SOFTWARE_STATUS } from './softwareRegistry.js';
import { SoftwareContextResolver } from './softwareContextResolver.js';
import { CrmAnswerService } from '../rag/crmAnswerService.js';

/**
 * Kiaan AI Multi-Software AI Orchestrator Service
 * Central gateway that resolves software context, isolates knowledge boundaries,
 * enforces permissions, and delegates requests to the appropriate software agent.
 */
export class OrchestratorService {
  /**
   * Orchestrates an incoming user message across registered software ecosystems.
   * @param {Object} params
   * @param {string} params.prompt
   * @param {Array} params.conversationHistory
   * @param {Object} params.requestContext { headers, body, user }
   * @returns {Promise<Object>} Orchestration result
   */
  static async orchestrate({ prompt, conversationHistory = [], requestContext = {} }) {
    // 1. Resolve software context
    const resolution = SoftwareContextResolver.resolveContext({
      prompt,
      conversationHistory,
      requestContext
    });

    // Case 1: General Query unrelated to any software (e.g. "Explain photosynthesis")
    if (resolution.isGeneralQuery || !resolution.resolved) {
      if (resolution.isAmbiguous) {
        return this._handleAmbiguity(prompt, resolution.candidates);
      }
      if (resolution.resolutionMethod === 'UNAUTHORIZED_SOFTWARE_ID') {
        return {
          handled: true,
          status: 'UNAUTHORIZED_SOFTWARE',
          systemPrompt: `[Orchestrator Notice] Security Warning: ${resolution.error} Please choose from active verified software systems.`
        };
      }
      return {
        handled: false,
        isGeneralQuery: true,
        softwareId: null
      };
    }

    const software = resolution.software;

    // Case 2: Software is registered but pending implementation
    if (software.status === SOFTWARE_STATUS.PENDING_AGENT) {
      return {
        handled: true,
        softwareId: software.softwareId,
        status: 'PENDING_AGENT',
        systemPrompt: `[Kiaan AI Orchestrator Status]
The software ecosystem '${software.softwareName}' (${software.description}) is registered in Kiaan AI, but its dedicated AI Agent is currently pending deployment.
Inform the user politely and honestly that '${software.softwareName}' is currently in staging/development and its live autonomous agent is coming soon. Do not invent operational data for pending agents.`
      };
    }

    // Case 3: Software is inactive
    if (software.status === SOFTWARE_STATUS.INACTIVE) {
      return {
        handled: true,
        softwareId: software.softwareId,
        status: 'INACTIVE',
        systemPrompt: `[Kiaan AI Orchestrator Status]
The software ecosystem '${software.softwareName}' is currently inactive or under maintenance. Advise the user to check system administration status.`
      };
    }

    // Case 4: Software is ACTIVE — Delegate to verified software agent
    return await this.delegateToAgent({
      software,
      userContext: requestContext.user,
      query: prompt,
      conversationHistory
    });
  }

  /**
   * Delegates execution to the verified software agent adapter.
   */
  static async delegateToAgent({ software, userContext, query, conversationHistory }) {
    // 1. CRM nErgy Delegation (Authoritative Existing Step 5 & Step 6 Implementation)
    if (software.softwareId === 'crm-nergy') {
      try {
        const crmResult = await CrmAnswerService.prepareCrmContext({
          query,
          conversationHistory,
          userContext
        });

        return {
          handled: true,
          softwareId: software.softwareId,
          softwareName: software.softwareName,
          status: 'ACTIVE_DELEGATION',
          systemPrompt: crmResult.systemPrompt,
          data: crmResult.liveData || null,
          toolExecuted: crmResult.toolExecuted || null,
          confidence: crmResult.confidence || 'HIGH',
          knowledgeSource: software.knowledgeSource
        };
      } catch (crmErr) {
        console.error('[Orchestrator] Error during CRM agent delegation:', crmErr.message);
        return {
          handled: true,
          softwareId: software.softwareId,
          status: 'AGENT_ERROR',
          systemPrompt: `[Orchestrator Error] Failed to delegate to '${software.softwareName}': ${crmErr.message}.`
        };
      }
    }

    // Fallback for unhandled active software
    return {
      handled: false,
      softwareId: software.softwareId,
      status: 'NO_ADAPTER'
    };
  }

  /**
   * Formats clarification response for ambiguous inquiries matching multiple software candidates.
   */
  static _handleAmbiguity(prompt, candidates = []) {
    const candidateNames = candidates.map((c) => `• ${c.name} (id: ${c.id})`).join('\n');
    return {
      handled: true,
      status: 'AMBIGUOUS',
      systemPrompt: `[Kiaan AI Orchestrator Clarification]
The user inquiry '${prompt}' matches multiple registered software systems:
${candidateNames}

Ask the user to clarify which software system they would like to access.`
    };
  }
}

