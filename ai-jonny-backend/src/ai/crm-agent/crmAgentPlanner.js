/**
 * CRM nErgy Agent Planner
 * Decomposes complex user inquiries into an ordered, bounded sequence of approved CRM tools.
 * Supports single-tool queries, multi-tool analytical workflows, and BANT qualification assessments.
 */
export class CrmAgentPlanner {
  static GOALS = {
    BANT_QUALIFICATION_ANALYSIS: 'BANT_QUALIFICATION_ANALYSIS',
    SALES_OPERATIONAL_ANALYSIS: 'SALES_OPERATIONAL_ANALYSIS',
    PIPELINE_STAGE_ANALYSIS: 'PIPELINE_STAGE_ANALYSIS',
    TASK_BOTTLENECK_ANALYSIS: 'TASK_BOTTLENECK_ANALYSIS',
    EXECUTIVE_OVERVIEW: 'EXECUTIVE_OVERVIEW',
    SINGLE_TOOL_LOOKUP: 'SINGLE_TOOL_LOOKUP'
  };

  /**
   * Plans the execution strategy based on user prompt and conversation history.
   * @param {string} prompt
   * @param {Array} history
   */
  static planExecution(prompt, history = []) {
    const q = String(prompt || '').toLowerCase();

    // 1. BANT Qualification Analysis (Budget, Authority, Need, Timeline)
    if (
      /\b(bant|qualification|qualify|lead\s+scoring|lead\s+quality)\b/i.test(q)
    ) {
      return {
        goal: this.GOALS.BANT_QUALIFICATION_ANALYSIS,
        isMultiTool: true,
        explanation: 'Decompose query into lead inspection and pipeline revenue validation for BANT assessment.',
        steps: [
          { tool: 'getMyAssignedLeads', args: { limit: 10 } },
          { tool: 'getPipelineValue', args: {} }
        ]
      };
    }

    // 2. Deal Pipeline & Stage Distribution Analysis (Evaluated before general sales)
    if (
      /\b(deal|deals|stages?|pipeline\s+health|stage\s+breakdown)\b/i.test(q) &&
      /\b(analyze|analysis|summary|distribution|breakdown|evaluate)\b/i.test(q)
    ) {
      return {
        goal: this.GOALS.PIPELINE_STAGE_ANALYSIS,
        isMultiTool: true,
        explanation: 'Evaluate pipeline stages and aggregate revenue opportunity.',
        steps: [
          { tool: 'getDealPipelineSummary', args: {} },
          { tool: 'getPipelineValue', args: {} }
        ]
      };
    }

    // 3. Comprehensive Sales & Operational Performance Analysis
    if (
      /\b(analyze|analysis|performance|operational\s+report|conversion\s+opportunities|review\s+sales|overall\s+health)\b/i.test(q) &&
      /\b(sales|leads?|pipeline|crm|business|team)\b/i.test(q)
    ) {
      return {
        goal: this.GOALS.SALES_OPERATIONAL_ANALYSIS,
        isMultiTool: true,
        explanation: 'Retrieve lead counts, pipeline revenue values, and overdue bottlenecks for comprehensive operational analysis.',
        steps: [
          { tool: 'getLeadCount', args: { filter: 'all' } },
          { tool: 'getPipelineValue', args: {} },
          { tool: 'getOverdueTasks', args: {} }
        ]
      };
    }

    // 4. Overdue Task & Team Bottleneck Analysis
    if (
      /\b(bottleneck|delay|overdue|late|pending\s+issues|stuck)\b/i.test(q) &&
      /\b(tasks?|work|operations?|action)\b/i.test(q)
    ) {
      return {
        goal: this.GOALS.TASK_BOTTLENECK_ANALYSIS,
        isMultiTool: true,
        explanation: 'Identify past-due tasks and correlate with assigned leads.',
        steps: [
          { tool: 'getOverdueTasks', args: {} },
          { tool: 'getMyAssignedLeads', args: { limit: 5 } }
        ]
      };
    }

    // 5. Executive / Dashboard Overview
    if (
      /\b(dashboard|executive\s+summary|business\s+overview|kya\s+chal\s+raha\s+hai|high\s+level)\b/i.test(q)
    ) {
      return {
        goal: this.GOALS.EXECUTIVE_OVERVIEW,
        isMultiTool: false,
        explanation: 'Fetch aggregate dashboard metrics across leads, pipeline, tasks, and invoices.',
        steps: [
          { tool: 'getDashboardSummary', args: {} }
        ]
      };
    }

    // 6. Targeted Single-Tool Direct Query (Fallthrough to direct tool)
    return this._planSingleTool(q);
  }

  static _planSingleTool(q) {
    if (/\b(assigned\s+to\s+me|my\s+leads|mere\s+leads|meri\s+leads)\b/i.test(q)) {
      return {
        goal: this.GOALS.SINGLE_TOOL_LOOKUP,
        isMultiTool: false,
        steps: [{ tool: 'getMyAssignedLeads', args: { limit: 10 } }]
      };
    }

    if (/\b(lead|leads)\b/i.test(q) && /\b(count|how\s+many|total|kitne|added|created)\b/i.test(q)) {
      const isToday = /\b(today|aaj)\b/i.test(q);
      return {
        goal: this.GOALS.SINGLE_TOOL_LOOKUP,
        isMultiTool: false,
        steps: [{ tool: 'getLeadCount', args: { filter: isToday ? 'today' : 'all' } }]
      };
    }

    if (/\b(task|tasks|kaam)\b/i.test(q) && /\b(overdue|late|pending)\b/i.test(q)) {
      return {
        goal: this.GOALS.SINGLE_TOOL_LOOKUP,
        isMultiTool: false,
        steps: [{ tool: 'getOverdueTasks', args: {} }]
      };
    }

    if (/\b(invoice|invoices|bills)\b/i.test(q)) {
      return {
        goal: this.GOALS.SINGLE_TOOL_LOOKUP,
        isMultiTool: false,
        steps: [{ tool: 'getPendingInvoices', args: {} }]
      };
    }

    if (/\b(pipeline\s+value|deal\s+value|revenue)\b/i.test(q)) {
      return {
        goal: this.GOALS.SINGLE_TOOL_LOOKUP,
        isMultiTool: false,
        steps: [{ tool: 'getPipelineValue', args: {} }]
      };
    }

    // Default fallback
    return {
      goal: this.GOALS.SINGLE_TOOL_LOOKUP,
      isMultiTool: false,
      steps: [{ tool: 'getLeadCount', args: { filter: 'all' } }]
    };
  }
}
