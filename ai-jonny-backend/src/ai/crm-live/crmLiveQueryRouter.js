import { CrmAuthBridge } from './crmAuthBridge.js';
import { CrmLiveToolRegistry } from './crmLiveToolRegistry.js';

/**
 * CRM nErgy Live Query Router
 * Parses user intent, selects and executes the appropriate live tool,
 * and formats verified ground-truth context for natural language generation.
 */
export class CrmLiveQueryRouter {
  /**
   * Detects the targeted live tool and extracts arguments from user question.
   * @param {string} question
   */
  static routeQuestionToTool(question) {
    const q = String(question || '').toLowerCase();

    // 1. My Assigned Leads
    if (
      /\b(assigned\s+to\s+me|my\s+leads|mere\s+leads|mujhe\s+assign|meri\s+leads)\b/i.test(q)
    ) {
      return { tool: 'getMyAssignedLeads', args: { limit: 10 } };
    }

    // 2. Leads Count (Today vs Total vs Status)
    if (
      /\b(lead|leads)\b/i.test(q) &&
      /\b(how\s+many|count|total|kitne|kitni|added|created|nayi)\b/i.test(q)
    ) {
      const isToday = /\b(today|aaj|current\s+day)\b/i.test(q);
      let status = null;
      if (/\b(new|nayi)\b/i.test(q)) status = 'NEW';
      if (/\b(qualified)\b/i.test(q)) status = 'QUALIFIED';
      if (/\b(won|converted)\b/i.test(q)) status = 'WON';

      return {
        tool: 'getLeadCount',
        args: { filter: isToday ? 'today' : 'all', status }
      };
    }

    // 3. Lead Details
    if (
      /\b(lead\s+(details|info|profile)|details\s+of\s+lead|about\s+lead)\b/i.test(q) ||
      (/\b(lead)\b/i.test(q) && /\b(show|batao|find|details|kya\s+hai)\b/i.test(q) && !/count|how\s+many|kitne/i.test(q))
    ) {
      const cleaned = q
        .replace(/lead\s+(details|info|profile)?/gi, '')
        .replace(/show|details\s+of|about|batao|kya\s+hai|ka|ki|ke/gi, '')
        .trim();
      return { tool: 'getLeadDetails', args: { query: cleaned.length > 2 ? cleaned : null } };
    }

    // 4. Overdue Tasks
    if (
      /\b(task|tasks|kaam)\b/i.test(q) &&
      /\b(overdue|late|pending|pending\s+tasks|pending\s+kaam)\b/i.test(q)
    ) {
      return { tool: 'getOverdueTasks', args: {} };
    }

    // 5. Invoices (Pending / Unpaid)
    if (
      /\b(invoice|invoices|bills|billing)\b/i.test(q) &&
      /\b(pending|unpaid|due|kitni|how\s+many|bache|baki)\b/i.test(q)
    ) {
      return { tool: 'getPendingInvoices', args: {} };
    }

    // 6. Pipeline Value & Deal Revenue
    if (
      /\b(pipeline\s+value|deal\s+value|total\s+revenue|revenue\s+pipeline|value\s+of\s+pipeline|kitna\s+value)\b/i.test(q)
    ) {
      return { tool: 'getPipelineValue', args: {} };
    }

    // 7. Deal Pipeline Summary / Stages
    if (
      /\b(deal|deals|pipeline)\b/i.test(q) &&
      /\b(summary|stages|breakdown|distribution|status)\b/i.test(q)
    ) {
      return { tool: 'getDealPipelineSummary', args: {} };
    }

    // 8. Contact Details
    if (
      /\b(contact|customer|client)\b/i.test(q) &&
      /\b(details|info|profile|batao|show)\b/i.test(q) &&
      !/how\s+many|count/i.test(q)
    ) {
      const cleaned = q
        .replace(/contact|customer|client|details|info|profile|batao|show/gi, '')
        .trim();
      return { tool: 'getContactDetails', args: { query: cleaned.length > 2 ? cleaned : null } };
    }

    // 9. Dashboard / High-level Overview
    if (
      /\b(dashboard|crm\s+summary|operational\s+summary|overview|kya\s+chal\s+raha\s+hai)\b/i.test(q)
    ) {
      return { tool: 'getDashboardSummary', args: {} };
    }

    // Default Fallback: Lead Count
    return { tool: 'getLeadCount', args: { filter: 'all' } };
  }

  /**
   * Processes live query end-to-end and returns ground-truth prompt context.
   * @param {string} question
   * @param {Object} reqUser
   */
  static async processLiveQuery(question, reqUser = null) {
    const userContext = await CrmAuthBridge.resolveUserContext(reqUser);
    const { tool, args } = this.routeQuestionToTool(question);

    const result = await CrmLiveToolRegistry.executeTool(tool, userContext, args);

    if (!result.authorized) {
      return {
        handled: true,
        tool,
        authorized: false,
        systemContext: `[CRM nErgy Live Security Warning]\nAccess Denied: The current user role ('${userContext.role}') is not authorized to access '${tool}'. Politely inform the user that their role lacks permission to view these live records. Do not invent or guess data.`
      };
    }

    if (!result.success) {
      return {
        handled: true,
        tool,
        authorized: true,
        systemContext: `[CRM nErgy Live Data Error]\nAn error occurred while querying live CRM data: ${result.error}. Inform the user directly of the issue without inventing records.`
      };
    }

    // Format verified real records into structured context for the LLM
    const formattedData = JSON.stringify(result.data, null, 2);
    const systemContext = `
[CRM nErgy LIVE REAL-TIME DATABASE RECORDS]
Query Tool Executed: ${tool}
Target Tenant: ${userContext.tenantId}
Caller Role: ${userContext.role}
Caller Identity: ${userContext.name || userContext.email || userContext.userId}

LIVE VERIFIED DATA (GROUND TRUTH):
${formattedData}

STRICT ANSWERING RULES:
1. Use ONLY the real numbers, names, and values provided in the LIVE VERIFIED DATA above.
2. If the count is 0 or records are empty, explicitly state that there are currently no records found in the CRM.
3. NEVER invent, hallucinate, extrapolate, or guess any lead names, revenue figures, or dates.
4. Present the figures clearly, professionally, and concisely with clean Markdown tables or bullet points.
5. If currency values are shown, format them nicely (e.g. $250,000).
`.trim();

    return {
      handled: true,
      tool,
      authorized: true,
      data: result.data,
      systemContext
    };
  }
}

