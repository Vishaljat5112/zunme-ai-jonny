import { SoftwareRegistry, SOFTWARE_STATUS } from './softwareRegistry.js';

/**
 * Kiaan AI Software Context Resolver
 * Resolves the target software ecosystem using multi-tier priority rules:
 * 1. Validated Authenticated Context (headers / body)
 * 2. Explicit Software Name or Alias Mention
 * 3. Conversation Follow-up Context (anaphora / continuity)
 * 4. Ambiguity Detection
 * 5. General Non-Software Query Fallback
 */
export class SoftwareContextResolver {
  /**
   * Resolves target software context from request parameters, prompt, and conversation history.
   * @param {Object} params
   * @param {string} params.prompt
   * @param {Array} params.conversationHistory
   * @param {Object} params.requestContext { headers, body, user }
   * @returns {Object} Resolution result
   */
  static resolveContext({ prompt = '', conversationHistory = [], requestContext = {} }) {
    const q = String(prompt || '').trim();
    const lower = q.toLowerCase();

    // -------------------------------------------------------------
    // PRIORITY 1: Authenticated Explicit Software Header / Body Parameter
    // -------------------------------------------------------------
    const rawSoftwareId =
      requestContext.headers?.['x-software-id'] ||
      requestContext.body?.softwareId ||
      requestContext.body?.project;

    if (rawSoftwareId && typeof rawSoftwareId === 'string') {
      const verified = SoftwareRegistry.getSoftware(rawSoftwareId) || SoftwareRegistry.findByAlias(rawSoftwareId);
      if (verified) {
        return {
          resolved: true,
          resolutionMethod: 'AUTHENTICATED_REQUEST_CONTEXT',
          software: verified,
          isAmbiguous: false,
          isGeneralQuery: false
        };
      }
      // Security: Untrusted or unknown softwareId passed by client is explicitly flagged
      return {
        resolved: false,
        resolutionMethod: 'UNAUTHORIZED_SOFTWARE_ID',
        software: null,
        error: `Software '${rawSoftwareId}' is not registered or authorized on the server.`,
        isAmbiguous: false,
        isGeneralQuery: false
      };
    }

    // -------------------------------------------------------------
    // PRIORITY 2: Explicit Software Name or Alias in Prompt
    // -------------------------------------------------------------
    const activeSoftwares = SoftwareRegistry.listAllSoftwares();
    const matchedSoftwares = [];

    for (const sw of activeSoftwares) {
      // Check full name
      if (lower.includes(sw.softwareName.toLowerCase())) {
        matchedSoftwares.push(sw);
        continue;
      }
      // Check aliases with boundary matching
      for (const alias of sw.aliases) {
        const regex = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (regex.test(lower)) {
          matchedSoftwares.push(sw);
          break;
        }
      }
    }

    // Single clear match
    if (matchedSoftwares.length === 1) {
      return {
        resolved: true,
        resolutionMethod: 'EXPLICIT_NAME_OR_ALIAS',
        software: matchedSoftwares[0],
        isAmbiguous: false,
        isGeneralQuery: false
      };
    }

    // Ambiguity detection (Prompt matched multiple software products)
    if (matchedSoftwares.length > 1) {
      return {
        resolved: false,
        resolutionMethod: 'AMBIGUOUS_MULTIPLE_MATCHES',
        software: null,
        candidates: matchedSoftwares.map((s) => ({ id: s.softwareId, name: s.softwareName })),
        isAmbiguous: true,
        isGeneralQuery: false
      };
    }

    // -------------------------------------------------------------
    // PRIORITY 3: Conversation Follow-up Context (Recent Turns)
    // -------------------------------------------------------------
    if (conversationHistory && conversationHistory.length > 0) {
      const recentTurns = conversationHistory.slice(-4).reverse();
      for (const msg of recentTurns) {
        const content = (msg.content || '').toLowerCase();
        for (const sw of activeSoftwares) {
          if (content.includes(sw.softwareName.toLowerCase()) || sw.aliases.some((a) => content.includes(a))) {
            // Check if current prompt is a follow-up inquiry
            const isFollowUp =
              /\b(it|this|that|these|those|isme|iska|unka|uske|show|details|batao|and|also)\b/i.test(lower) ||
              lower.length < 40;
            if (isFollowUp) {
              return {
                resolved: true,
                resolutionMethod: 'CONVERSATION_FOLLOW_UP',
                software: sw,
                isAmbiguous: false,
                isGeneralQuery: false
              };
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 4: Domain Keyword Heuristic (e.g. leads, pipeline, CRM terms)
    // -------------------------------------------------------------
    const crmKeywords = [
      'lead', 'leads', 'deal', 'deals', 'pipeline', 'sales stages', 'invoices',
      'bestie ai', 'zunme', 'crm pro', 'sales pipeline'
    ];
    if (crmKeywords.some((kw) => lower.includes(kw))) {
      const crm = SoftwareRegistry.getSoftware('crm-nergy');
      if (crm) {
        return {
          resolved: true,
          resolutionMethod: 'DOMAIN_KEYWORD_HEURISTIC',
          software: crm,
          isAmbiguous: false,
          isGeneralQuery: false
        };
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 5: General Query Fallback (Unrelated to any registered software)
    // -------------------------------------------------------------
    return {
      resolved: false,
      resolutionMethod: 'GENERAL_CHAT_FALLBACK',
      software: null,
      isAmbiguous: false,
      isGeneralQuery: true
    };
  }
}

