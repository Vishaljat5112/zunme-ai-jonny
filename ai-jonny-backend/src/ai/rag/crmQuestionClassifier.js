/**
 * CRM nErgy Question Classifier
 * Fast, deterministic (<1ms) natural language question classifier for CRM nErgy queries.
 * Identifies question type, relevant module, intent, language, and follow-up markers without extra LLM overhead.
 */

export const CRM_QUESTION_TYPES = {
  SOFTWARE_OVERVIEW: 'SOFTWARE_OVERVIEW',
  MODULE_EXPLANATION: 'MODULE_EXPLANATION',
  MENU_NAVIGATION: 'MENU_NAVIGATION',
  FEATURE_EXPLANATION: 'FEATURE_EXPLANATION',
  FIELD_EXPLANATION: 'FIELD_EXPLANATION',
  WORKFLOW: 'WORKFLOW',
  ROLE_PERMISSION: 'ROLE_PERMISSION',
  API_EXPLANATION: 'API_EXPLANATION',
  DATABASE_EXPLANATION: 'DATABASE_EXPLANATION',
  REPORT_EXPLANATION: 'REPORT_EXPLANATION',
  AI_FEATURE: 'AI_FEATURE',
  LIVE_DATA_QUERY: 'LIVE_DATA_QUERY',
  GENERAL_QUESTION: 'GENERAL_QUESTION',
  UNKNOWN_CRM_QUESTION: 'UNKNOWN_CRM_QUESTION'
};

export class CrmQuestionClassifier {
  /**
   * Classify user query with contextual reference resolution
   * @param {string} query - Latest user message
   * @param {Array} conversationHistory - Recent turns from context
   * @returns {Object} Structured classification result
   */
  static classify(query = '', conversationHistory = []) {
    if (!query || typeof query !== 'string') {
      return {
        type: CRM_QUESTION_TYPES.GENERAL_QUESTION,
        isCrmRelated: false,
        isLiveDataQuery: false,
        isFollowUp: false,
        language: 'english',
        relevantModule: null,
        targetEntity: null,
        confidence: 0
      };
    }

    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();

    // 1. Language Detection (English vs Hindi vs Hinglish)
    const isHindiScript = /[\u0900-\u097F]/.test(trimmed);
    const hinglishMarkers = /\b(kya|kaise|hota|hoti|hote|hai|hain|karo|batao|kisme|isme|iska|iski|usme|kaha|kaun|kitne|kitna|chahiye|karein|samjhao|dikhao)\b/i;
    const isHinglish = !isHindiScript && hinglishMarkers.test(lower);
    const language = isHindiScript ? 'hindi' : isHinglish ? 'hinglish' : 'english';

    // 2. Follow-up / Anaphora Detection ("isme", "iska", "it", "this", "that")
    const followUpRegex = /\b(isme|iska|iski|usme|uska|iski|inme|it|this|that|these|its|previous|same)\b/i;
    const isFollowUp = followUpRegex.test(lower) && conversationHistory.length > 0;

    let antecedentSubject = null;
    if (isFollowUp) {
      antecedentSubject = this._extractAntecedentSubject(conversationHistory);
    }

    // Combine effective query for entity mapping
    const effectiveText = antecedentSubject ? `${lower} ${antecedentSubject.toLowerCase()}` : lower;

    // 3. Relevant Module Identification
    const relevantModule = this._detectModule(effectiveText);

    // 4. Live Data Query Detection (Queries asking for real-time live database values)
    const liveDataMarkers = /\b(today|right now|aaj|current count|how many leads|live deal|my open deals|mere deals|kitne leads hain|total balance|live balance|database me abhi)\b/i;
    const isAskingForCountOrLive = liveDataMarkers.test(lower) && !/\b(explain|stages|how to|kaise|process|workflow|steps)\b/i.test(lower);

    if (isAskingForCountOrLive) {
      return {
        type: CRM_QUESTION_TYPES.LIVE_DATA_QUERY,
        isCrmRelated: true,
        isLiveDataQuery: true,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule,
        targetEntity: relevantModule,
        confidence: 0.95
      };
    }

    // 5. Categorize by Domain Patterns
    // AI Feature
    if (/\b(bestie|bestie ai|zunme|zunme ai|ai agent|ai superhouse|voice agent|video agent|talking avatar)\b/i.test(effectiveText)) {
      return {
        type: CRM_QUESTION_TYPES.AI_FEATURE,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule: 'AI SuperHouse / Bestie AI',
        confidence: 0.95
      };
    }

    // API & Architecture
    if (/\b(api|apis|endpoint|endpoints|rest|controller|controllers|route handler|http)\b/i.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.API_EXPLANATION,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule,
        confidence: 0.95
      };
    }

    // Database & Schema
    if (/\b(database|database model|models|prisma|schema|entities|table|tables|foreign key)\b/i.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.DATABASE_EXPLANATION,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule,
        confidence: 0.95
      };
    }

    // Roles & Permissions (RBAC)
    if (/\b(role|roles|permission|permissions|rbac|persona|access|who can|kaun kar sakta|rights|privilege)\b/i.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.ROLE_PERMISSION,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule,
        confidence: 0.95
      };
    }

    // Navigation & Menus
    if (/\b(navigate|navigation|menu|menus|sidebar|kaha hai|route|routes|path|url|where is|open)\b/i.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.MENU_NAVIGATION,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule,
        confidence: 0.92
      };
    }

    // Workflows (Step-by-step business processes)
    if (/\b(workflow|workflows|step by step|steps|how to convert|conversion work|kaise hota|kaise karein|process|lifecycle|lead to deal|lead to cash|requisition)\b/i.test(effectiveText)) {
      return {
        type: CRM_QUESTION_TYPES.WORKFLOW,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule,
        confidence: 0.95
      };
    }

    // Forms & Fields
    if (/\b(field|fields|form|input|inputs|dropdown|column|columns)\b/i.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.FIELD_EXPLANATION,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule,
        confidence: 0.90
      };
    }

    // Software Overview
    if (/^(what is crm n?ergy|crm n?ergy kya hai|about crm n?ergy|tell me about crm n?ergy|explain crm n?ergy architecture)\b/i.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.SOFTWARE_OVERVIEW,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp: false,
        language,
        relevantModule: 'System Architecture',
        confidence: 0.98
      };
    }

    // Module Explanation
    if (/\b(all modules|explain all modules|saare modules|list modules|modules list|which module|kon sa module|kisme hota)\b/i.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.MODULE_EXPLANATION,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule: relevantModule || 'Core Modules',
        confidence: 0.95
      };
    }

    // Specific Feature or Module Query
    if (relevantModule) {
      return {
        type: CRM_QUESTION_TYPES.FEATURE_EXPLANATION,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule,
        confidence: 0.88
      };
    }

    // Check if query is an impossible / non-existent concept inside CRM
    if (/\b(quantum|teleportation|blockchain mining|alien|magic)\b/i.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.UNKNOWN_CRM_QUESTION,
        isCrmRelated: false,
        isLiveDataQuery: false,
        isFollowUp: false,
        language,
        relevantModule: null,
        confidence: 0.90
      };
    }

    // Check if CRM keyword is present
    const crmKeywords = /\b(crm|crm n?ergy|lead|deal|pipeline|contact|invoice|bom|ats|swmtp|ebox|omp|oal)\b/i;
    if (crmKeywords.test(lower)) {
      return {
        type: CRM_QUESTION_TYPES.FEATURE_EXPLANATION,
        isCrmRelated: true,
        isLiveDataQuery: false,
        isFollowUp,
        antecedentSubject,
        language,
        relevantModule: 'CRM Core',
        confidence: 0.75
      };
    }

    // Default: General non-CRM question
    return {
      type: CRM_QUESTION_TYPES.GENERAL_QUESTION,
      isCrmRelated: false,
      isLiveDataQuery: false,
      isFollowUp: false,
      language,
      relevantModule: null,
      confidence: 0.50
    };
  }

  /**
   * Identifies the primary CRM module from text tokens
   */
  static _detectModule(text) {
    if (/\b(lead|leads|lead conversion|inbound lead)\b/i.test(text)) return 'Leads';
    if (/\b(pipeline|stage|stages|kanban|deal|deals)\b/i.test(text)) return 'Sales Pipeline';
    if (/\b(contact|contacts|customer|account)\b/i.test(text)) return 'Contacts';
    if (/\b(inventory|stock|warehouse|sku|reorder)\b/i.test(text)) return 'Warehouse Inventory';
    if (/\b(hr|recruiting|ats|candidate|employee|interview|hiring)\b/i.test(text)) return 'HR & Recruiting';
    if (/\b(procurement|purchase order|po approval|supplier)\b/i.test(text)) return 'Procurement & Purchase Orders';
    if (/\b(manufacturing|work order|bom|bill of materials)\b/i.test(text)) return 'Manufacturing & Production';
    if (/\b(invoice|invoices|invoicing|billing|accounting)\b/i.test(text)) return 'Invoicing & Accounting';
    if (/\b(ticket|tickets|support|sla|customer care)\b/i.test(text)) return 'Customer Support';
    if (/\b(ebox|secured ebox|swmtp)\b/i.test(text)) return 'Administration & Secured eBox';
    if (/\b(bestie|zunme|ai studio|avatar)\b/i.test(text)) return 'AI SuperHouse / Bestie AI';
    if (/\b(erp project|milestone|gantt)\b/i.test(text)) return 'ERP Projects';
    if (/\b(territory|territories|quota)\b/i.test(text)) return 'Territory Management';
    return null;
  }

  /**
   * Resolves antecedent subject from previous chat messages for follow-ups
   */
  static _extractAntecedentSubject(history) {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const text = msg.content || '';
      const detected = this._detectModule(text);
      if (detected) {
        return detected;
      }
    }
    return null;
  }
}
