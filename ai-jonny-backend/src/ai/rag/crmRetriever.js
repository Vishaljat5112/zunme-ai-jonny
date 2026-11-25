import { CrmEmbeddingService } from './crmEmbeddingService.js';
import { CrmVectorStore } from './crmVectorStore.js';
import { CrmQuestionClassifier, CRM_QUESTION_TYPES } from './crmQuestionClassifier.js';
import { config } from '../../config/index.js';

export class CrmRetriever {
  constructor(options = {}) {
    this.topK = options.topK || config.rag?.topK || 4;
    this.scoreThreshold = options.scoreThreshold ?? config.rag?.scoreThreshold ?? 0.50;
    this.softwareId = options.softwareId || 'crm-nergy';

    this.embeddingService = options.embeddingService || new CrmEmbeddingService();
    this.vectorStore = options.vectorStore || new CrmVectorStore();
  }

  /**
   * Lightweight query expansion to bridge Hinglish / conversational queries to technical docs
   */
  expandQuery(query = '', classification = null) {
    if (!query) return query;
    const clean = query.trim();
    const expansions = [];

    // If follow-up with known antecedent subject, include it
    if (classification?.isFollowUp && classification?.antecedentSubject) {
      expansions.push(`${classification.antecedentSubject} module in CRM nErgy`);
    }

    const lower = clean.toLowerCase();

    // Hinglish / conversational expansions for key workflows
    if (/\b(convert|lead convert|kaise hota)\b/i.test(lower)) {
      expansions.push('lead conversion workflow convert lead to contact deal');
    }
    if (/\b(pipeline|kanban|stages)\b/i.test(lower)) {
      expansions.push('sales pipeline 8 stages new lead qualified proposal won');
    }
    if (/\b(inventory|stock|warehouse)\b/i.test(lower)) {
      expansions.push('warehouse inventory items stock levels SKU');
    }
    if (/\b(po|purchase order|procurement|approve)\b/i.test(lower)) {
      expansions.push('procurement purchase order approval workflow');
    }
    if (/\b(ats|recruiting|hiring|candidate)\b/i.test(lower)) {
      expansions.push('HR recruiting candidate ATS pipeline application stages');
    }
    if (/\b(role|roles|permission|rbac|who can)\b/i.test(lower)) {
      expansions.push('user roles RBAC permissions persona access matrix');
    }
    if (/\b(invoice|invoicing|billing)\b/i.test(lower)) {
      expansions.push('invoicing payment accounts receivable analytic accounting');
    }

    if (expansions.length > 0) {
      return `${clean} | Context: ${expansions.join(' ')}`;
    }

    return clean;
  }

  /**
   * Retrieve relevant CRM knowledge chunks with intent-aware ranking & confidence scoring
   * @param {string} query - User question
   * @param {Object} overrideOptions
   * @returns {Promise<{ chunks: Array, query: string, topScore: number, confidence: string, sources: Array, hasRelevantKnowledge: boolean }>}
   */
  async retrieve(query, overrideOptions = {}) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return {
        chunks: [],
        query: '',
        topScore: 0,
        confidence: 'NONE',
        sources: [],
        hasRelevantKnowledge: false
      };
    }

    const cleanQuery = query.trim();
    const effectiveTopK = overrideOptions.topK || this.topK;
    const effectiveThreshold = overrideOptions.scoreThreshold ?? this.scoreThreshold;
    const history = overrideOptions.history || [];

    // 1. Classify question intent
    const classification = overrideOptions.classification || CrmQuestionClassifier.classify(cleanQuery, history);

    // 2. Perform lightweight query expansion
    const expandedQuery = this.expandQuery(cleanQuery, classification);

    // 3. Generate query embedding via Ollama nomic-embed-text
    const queryVector = await this.embeddingService.getEmbedding(expandedQuery);

    // 4. Query vector store with isolation filter (fetching topK + 2 for reranking/dedup)
    const rawMatches = await this.vectorStore.search({
      queryVector,
      topK: effectiveTopK + 3,
      scoreThreshold: effectiveThreshold,
      filterSoftwareId: this.softwareId
    });

    if (!rawMatches || rawMatches.length === 0) {
      return {
        chunks: [],
        query: cleanQuery,
        topScore: 0,
        confidence: 'LOW',
        sources: [],
        hasRelevantKnowledge: false,
        classification
      };
    }

    // 5. Source Prioritization & Category Reranking based on intent
    const reranked = rawMatches.map((chunk) => {
      let boostedScore = chunk.score;
      const docName = (chunk.metadata?.document_name || '').toUpperCase();
      const cat = (chunk.metadata?.category || '').toUpperCase();

      // Boost matching document category
      if (classification.type === CRM_QUESTION_TYPES.WORKFLOW && docName.includes('WORKFLOW')) {
        boostedScore += 0.05;
      } else if (classification.type === CRM_QUESTION_TYPES.API_EXPLANATION && docName.includes('API')) {
        boostedScore += 0.05;
      } else if (classification.type === CRM_QUESTION_TYPES.DATABASE_EXPLANATION && docName.includes('DATABASE')) {
        boostedScore += 0.05;
      } else if (classification.type === CRM_QUESTION_TYPES.ROLE_PERMISSION && docName.includes('ROLES')) {
        boostedScore += 0.05;
      } else if (classification.type === CRM_QUESTION_TYPES.MENU_NAVIGATION && (docName.includes('MENU') || docName.includes('ROUTES'))) {
        boostedScore += 0.05;
      } else if (classification.type === CRM_QUESTION_TYPES.MODULE_EXPLANATION && docName.includes('MODULE')) {
        boostedScore += 0.04;
      }

      // Boost matching module name
      if (classification.relevantModule && chunk.content?.toLowerCase().includes(classification.relevantModule.toLowerCase())) {
        boostedScore += 0.03;
      }

      return {
        ...chunk,
        rerankedScore: boostedScore
      };
    });

    reranked.sort((a, b) => b.rerankedScore - a.rerankedScore);

    // De-duplicate chunks by chunk id or content hash
    const uniqueChunks = [];
    const seenHashes = new Set();
    for (const c of reranked) {
      const hash = c.metadata?.contentHash || c.id;
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        uniqueChunks.push(c);
      }
      if (uniqueChunks.length >= effectiveTopK) break;
    }

    // Extract unique source documents
    const sourcesSet = new Set();
    for (const m of uniqueChunks) {
      const src = m.metadata?.document_name || m.metadata?.source_reference;
      if (src) sourcesSet.add(src);
    }

    const topScore = uniqueChunks[0]?.score || 0;

    // 6. Compute Knowledge Confidence
    let confidence = 'LOW';
    if (topScore >= 0.63 && uniqueChunks.length >= 2) {
      confidence = 'HIGH';
    } else if (topScore >= 0.50) {
      confidence = 'MEDIUM';
    }

    return {
      chunks: uniqueChunks,
      query: cleanQuery,
      topScore,
      confidence,
      sources: Array.from(sourcesSet),
      hasRelevantKnowledge: uniqueChunks.length > 0 && topScore >= effectiveThreshold,
      classification
    };
  }

  /**
   * Formats retrieved chunks into an injection-ready system prompt block
   */
  formatContextForPrompt(retrievalResult) {
    if (!retrievalResult || !retrievalResult.hasRelevantKnowledge || retrievalResult.chunks.length === 0) {
      return '';
    }

    const { chunks, sources, confidence, classification } = retrievalResult;

    const formattedSnippets = chunks.map((chunk, idx) => {
      const docName = chunk.metadata?.document_name || 'CRM Document';
      const section = chunk.metadata?.section_header ? ` > ${chunk.metadata.section_header}` : '';
      const scorePct = Math.round((chunk.score || 0) * 100);

      return `[Chunk ${idx + 1} | Source: ${docName}${section} | Relevance: ${scorePct}%]\n${chunk.content}`;
    });

    const categoryNote = classification?.type ? `Detected Intent: ${classification.type} (${classification.relevantModule || 'General CRM'})` : '';

    return [
      '## Retrieved CRM nErgy Software Documentation (Ground Truth):',
      `> Intent & Module: ${categoryNote || 'CRM Knowledge Retrieval'}`,
      `> Confidence Level: ${confidence}`,
      `> Document Sources: ${sources.join(', ')}`,
      '> Grounding Rule: Base your technical explanation strictly on the facts present in these retrieved chunks. Never fabricate live tenant records, fake customer counts, or undocumented buttons.',
      '',
      formattedSnippets.join('\n\n---\n\n')
    ].join('\n');
  }
}
