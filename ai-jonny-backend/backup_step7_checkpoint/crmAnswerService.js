import { CrmQuestionClassifier, CRM_QUESTION_TYPES } from './crmQuestionClassifier.js';
import { crmRagService } from './crmRagService.js';
import { CrmKnowledgeLoader } from '../knowledge/crmKnowledgeLoader.js';
import { CrmLiveQueryRouter } from '../crm-live/crmLiveQueryRouter.js';
import { CrmAgentService } from '../crm-agent/crmAgentService.js';

export class CrmAnswerService {
  /**
   * Prepares complete, intelligent CRM nErgy system context tailored to question intent
   * @param {Object} params
   * @param {string} params.query - Latest user message
   * @param {Array} params.conversationHistory - Recent turns
   * @param {string} params.baseSystemPrompt - Foundational CRM prompt
   * @returns {Promise<{ systemPrompt: string, classification: Object, retrievalResult: Object, confidence: string }>}
   */
  static async prepareCrmContext({ query, conversationHistory = [], baseSystemPrompt = '', userContext = null }) {
    // 1. Deterministic Question Classification
    const classification = CrmQuestionClassifier.classify(query, conversationHistory);

    // 2. Load foundational CRM prompt if not supplied
    const basePrompt = baseSystemPrompt || (await CrmKnowledgeLoader.loadSystemPrompt());

    // Case A: LIVE DATA / AGENT QUERY (e.g. "How many leads were added today?", "Analyze sales performance")
    if (classification.type === CRM_QUESTION_TYPES.LIVE_DATA_QUERY || CrmAgentService.isAgentQuery(query)) {
      let liveContextBlock = '';
      let liveResultData = null;
      let toolName = null;

      try {
        if (CrmAgentService.isAgentQuery(query)) {
          const agentResult = await CrmAgentService.executeAgentWorkflow({
            query,
            conversationHistory,
            reqUser: userContext
          });
          if (agentResult && agentResult.handled) {
            liveContextBlock = '\n\n' + agentResult.systemPrompt;
            liveResultData = agentResult.data;
            toolName = agentResult.toolsExecuted.join(', ');
          }
        } else {
          const liveResult = await CrmLiveQueryRouter.processLiveQuery(query, userContext);
          if (liveResult && liveResult.handled) {
            liveContextBlock = '\n\n' + liveResult.systemContext;
            liveResultData = liveResult.data;
            toolName = liveResult.tool;
          }
        }
      } catch (liveErr) {
        console.warn('[CRM Live/Agent Router] Error processing query:', liveErr.message);
      }

      const liveDataInstructions = [
        basePrompt,
        '',
        '---',
        '## CRM OPERATIONAL NOTICE: LIVE DYNAMIC DATA REQUEST',
        '> The user is asking for live transactional records or current counts (e.g. today’s leads, current active deals, live balance).',
        '> STRICT RULE: NEVER fabricate fake deal values, customer names, or imaginary counts.',
        '> INSTRUCTION:',
        '1. If LIVE REAL-TIME DATABASE RECORDS are provided below, answer directly and accurately using those verified numbers and records.',
        '2. If no matching records exist or count is zero, state that clearly without guessing.',
        '3. Mention that users can also view real-time data in the CRM nErgy Dashboard at `/crm/dashboard` or the corresponding module directory.',
        '4. Answer in the user\'s language (' + classification.language + ').',
        '---'
      ].join('\n') + liveContextBlock;

      return {
        systemPrompt: liveDataInstructions,
        classification,
        liveData: liveResultData,
        toolExecuted: toolName,
        retrievalResult: { chunks: [], hasRelevantKnowledge: false, topScore: 0, sources: [] },
        confidence: 'HIGH'
      };
    }

    // Case B: UNKNOWN / FICTITIOUS FEATURE (e.g. "quantum teleportation in CRM")
    if (classification.type === CRM_QUESTION_TYPES.UNKNOWN_CRM_QUESTION) {
      const unknownFeatureInstructions = [
        basePrompt,
        '',
        '---',
        '## CRM DOCUMENTATION NOTICE: UNDOCUMENTED CONCEPT',
        '> The user is asking about a concept that is not part of CRM nErgy enterprise software.',
        '> STRICT RULE: Do NOT invent explanations for non-existent features or imaginary settings.',
        '> INSTRUCTION: State clearly, politely, and honestly:',
        '"I could not find sufficient documented information about this feature in the current CRM nErgy knowledge base. This capability is not documented in the CRM nErgy enterprise software specifications."',
        '---'
      ].join('\n');

      return {
        systemPrompt: unknownFeatureInstructions,
        classification,
        retrievalResult: { chunks: [], hasRelevantKnowledge: false, topScore: 0, sources: [] },
        confidence: 'INSUFFICIENT'
      };
    }

    // 3. Intelligent Semantic Retrieval via RAG Engine
    const retrievalResult = await crmRagService.searchKnowledge(query, {
      classification,
      history: conversationHistory,
      topK: classification.type === CRM_QUESTION_TYPES.WORKFLOW ? 4 : 3,
      scoreThreshold: 0.50
    });

    // Case C: INSUFFICIENT KNOWLEDGE RETRIEVED (Score < 0.50)
    if (!retrievalResult.hasRelevantKnowledge || retrievalResult.chunks.length === 0) {
      const missingDocInstructions = [
        basePrompt,
        '',
        '---',
        '## CRM KNOWLEDGE RETRIEVAL STATUS: INSUFFICIENT DOCUMENTATION',
        '> No high-confidence documentation chunks were found for this query in the CRM nErgy knowledge base.',
        '> STRICT RULE: Respond honestly without hallucinating undocumented settings, API endpoints, or database tables.',
        '> State clearly: "I could not find sufficient documented information about this feature in the current CRM nErgy knowledge base."',
        '---'
      ].join('\n');

      return {
        systemPrompt: missingDocInstructions,
        classification,
        retrievalResult,
        confidence: 'LOW'
      };
    }

    // Case D: VERIFIED KNOWLEDGE RETRIEVED — Construct Grounded Structured Context
    const ragBlock = crmRagService.retriever.formatContextForPrompt(retrievalResult);

    // Build intent-specific formatting guidelines
    const intentGuidelines = [];
    if (classification.type === CRM_QUESTION_TYPES.WORKFLOW) {
      intentGuidelines.push(
        '### Workflow Response Format:',
        '1. **Direct Summary:** Briefly summarize the end-to-end process in 1-2 sentences.',
        '2. **Relevant Module & Route:** Mention the exact frontend menu and route (e.g. `/crm/leads` or `/crm/pipeline`).',
        '3. **Step-by-Step Guide:** Provide numbered, actionable steps with exact button names in bold (e.g. click **"Convert to Deal"**).',
        '4. **Required Roles / Permissions:** Mention which user personas have authority (e.g. `operations_sales_admin` or `business_owner`).',
        '5. **Sources:** Cite the source files at the end.'
      );
    } else if (classification.type === CRM_QUESTION_TYPES.MENU_NAVIGATION) {
      intentGuidelines.push(
        '### Navigation Guide:',
        'State the exact sidebar navigation link, icon, and frontend route URL (e.g. `/hr/recruiting` or `/erp/inventory`) directly.'
      );
    } else if (classification.type === CRM_QUESTION_TYPES.ROLE_PERMISSION) {
      intentGuidelines.push(
        '### RBAC Explanation:',
        'Clarify the specific persona boundaries from the 12 CRM nErgy user roles, and note whether a role has read-only or full administrative write privilege.'
      );
    }

    // Language tone instructions
    const langInstructions =
      classification.language === 'hinglish' || classification.language === 'hindi'
        ? '- **Language:** The user asked in Hindi/Hinglish. Respond in natural, warm, professional Hinglish (or Hindi) using standard CRM terms (Leads, Deals, Pipeline, etc.).'
        : '- **Language:** Respond in clear, professional, structured English.';

    const structuredSystemPrompt = [
      basePrompt,
      '',
      '---',
      ragBlock,
      '---',
      '## CRM RESPONSE INSTRUCTIONS:',
      langInstructions,
      '- Base your response strictly on the retrieved documentation above.',
      intentGuidelines.join('\n'),
      '- Where helpful, list the verified document sources (e.g. `CRM_MODULE_INVENTORY.md`, `CRM_WORKFLOWS.md`).',
      '- If a question is simple, give a direct, concise answer without unnecessary padding.'
    ].join('\n');

    return {
      systemPrompt: structuredSystemPrompt,
      classification,
      retrievalResult,
      confidence: retrievalResult.confidence
    };
  }
}

