import { CrmAuthBridge } from '../crm-live/crmAuthBridge.js';
import { CrmAgentPlanner } from './crmAgentPlanner.js';
import { CrmAgentExecutor } from './crmAgentExecutor.js';
import { CrmQuestionClassifier } from '../rag/crmQuestionClassifier.js';

/**
 * CRM nErgy Agent Service
 * Primary coordinator for the autonomous CRM AI Agent.
 * Decomposes complex operational goals, validates action security,
 * executes multi-tool workflows, and synthesizes real ground-truth data into
 * structured natural language prompts.
 */
export class CrmAgentService {
  /**
   * Evaluates if a query should be handled by the multi-tool Agent engine.
   * @param {string} query
   */
  static isAgentQuery(query) {
    const q = String(query || '').toLowerCase();
    return (
      /\b(analyze|analysis|bant|qualification|performance|operational\s+report|bottlenecks?|review|breakdown|evaluate)\b/i.test(q) &&
      /\b(crm|leads?|pipeline|deals?|tasks?|sales|business)\b/i.test(q)
    );
  }

  /**
   * Executes the full Agent workflow: Plan -> Guard -> Execute -> Synthesize.
   * @param {Object} params { query, conversationHistory, reqUser }
   */
  static async executeAgentWorkflow({ query, conversationHistory = [], reqUser = null }) {
    // 1. Resolve authentic CRM user identity and tenant context
    const userContext = await CrmAuthBridge.resolveUserContext(reqUser);

    // 2. Classify language and context
    const classification = CrmQuestionClassifier.classify(query, conversationHistory);

    // 3. Generate Agent Execution Plan
    const plan = CrmAgentPlanner.planExecution(query, conversationHistory);

    // 4. Execute Plan through Guarded Executor
    const execution = await CrmAgentExecutor.executePlan(plan, userContext);

    // 5. Build Grounded Natural Language Synthesis Prompt
    const systemPrompt = this._buildSynthesisPrompt({
      query,
      userContext,
      plan,
      execution,
      language: classification.language
    });

    return {
      handled: true,
      goal: plan.goal,
      isMultiTool: plan.isMultiTool,
      toolsExecuted: execution.toolsExecuted,
      data: execution.results,
      guardsEnforced: execution.guardsEnforced,
      systemPrompt,
      classification
    };
  }

  /**
   * Constructs the structured prompt for LLM synthesis.
   */
  static _buildSynthesisPrompt({ query, userContext, plan, execution, language }) {
    const jsonRecords = JSON.stringify(execution.results, null, 2);
    const guardsText = execution.guardsEnforced.length > 0
      ? `\nSECURITY GUARDS ENFORCED:\n${JSON.stringify(execution.guardsEnforced, null, 2)}\n`
      : '';

    let specializedGuidance = '';

    // BANT Qualification Guidance
    if (plan.goal === CrmAgentPlanner.GOALS.BANT_QUALIFICATION_ANALYSIS) {
      specializedGuidance = `
### BANT QUALIFICATION FRAMEWORK INSTRUCTIONS:
Analyze the verified lead records using the standard BANT framework:
1. **Budget (B)**: Evaluate financial capacity from lead estimatedValue (e.g. $250,000 vs $120,000) and compare with pipeline totals.
2. **Authority (A)**: Check lead company structure, source channel, and decision-maker indications.
3. **Need (N)**: Check current lead qualification state, lead score, and commercial territory.
4. **Timeline (T)**: Review lead creation date, stage readiness, and any pending task deadlines.
Provide a clear qualification summary table and recommended next steps for each lead.`;
    }

    // Sales & Operational Analysis Guidance
    if (plan.goal === CrmAgentPlanner.GOALS.SALES_OPERATIONAL_ANALYSIS) {
      specializedGuidance = `
### SALES & OPERATIONAL HEALTH INSTRUCTIONS:
Provide an executive breakdown covering:
1. **Lead Generation Volume**: Total active leads vs leads added today.
2. **Revenue Opportunity**: Active deal pipeline value + prospective lead value.
3. **Operational Bottlenecks**: Identify overdue tasks that require immediate attention.
4. **Actionable Recommendations**: 2-3 specific operational next steps.`;
    }

    return `
[CRM nErgy AUTONOMOUS AI AGENT EXECUTION REPORT]
Executed Goal: ${plan.goal}
Multi-Tool Workflow: ${plan.isMultiTool}
Target Tenant: ${userContext.tenantId}
Caller Role: ${userContext.role}
Caller Identity: ${userContext.name || userContext.email || userContext.userId}
Tools Executed: ${execution.toolsExecuted.join(', ') || 'None'}
${guardsText}
VERIFIED LIVE DATABASE RECORDS (GROUND TRUTH):
${jsonRecords}

${specializedGuidance}

STRICT AGENT ANSWERING RULES:
1. Ground ALL conclusions strictly in the VERIFIED LIVE DATABASE RECORDS above.
2. Never invent or hallucinate metrics, names, currency amounts, or overdue tasks.
3. If no records exist for a metric, explicitly state that no records were found.
4. Format output cleanly using Markdown tables, bold headers, and bullet points.
5. Answer naturally in the user's preferred language (${language}).
`.trim();
  }
}

