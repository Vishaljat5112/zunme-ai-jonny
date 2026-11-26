/**
 * Reusable AI Service Foundation for Zunme AI Chat, AI Lytics Office & EgoLytics Charts.
 * Reuses existing backend AI provider routing (Ollama, Grok, OpenAI, Gemini)
 * and unified generation endpoints.
 */

import { apiClient, ModelInfo } from './apiClient';
import { ChatMessage } from '../types';

export interface GenerateCompletionOptions {
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  webSearch?: boolean;
  context?: string;
  signal?: AbortSignal;
}

export interface CompletionResponse {
  success: boolean;
  content: string;
  wordCount?: number;
  model?: string;
  timestamp?: string;
  error?: string;
}

export class AiService {
  /**
   * Retrieves active AI models available on the server
   */
  public async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const res = await apiClient.getModels();
      return res.models || [];
    } catch (err) {
      console.warn('Failed to fetch available AI models:', err);
      return [
        { id: 'gemma3:4b', name: 'Gemma 3 (4B) 🌟 [Default]', tag: 'Default' },
        { id: 'qwen2.5:3b', name: 'Qwen 2.5 (3B) 🚀 [Fast]', tag: 'Fast' }
      ];
    }
  }

  /**
   * Dispatches streaming chat to the backend SSE endpoint
   */
  public async streamChat(options: {
    conversationId: string;
    content: string;
    model?: string;
    attachmentIds?: string[];
    webSearch?: boolean;
    history?: Array<{ role: string; content: string }>;
    onChunk?: (delta: string) => void;
    onDone?: (msg: ChatMessage) => void;
    onError?: (err: string) => void;
    signal?: AbortSignal;
  }): Promise<ChatMessage> {
    return apiClient.sendMessageStream(options);
  }

  /**
   * Non-streaming direct AI generation (for one-off tool runs or office drafts)
   */
  public async generateCompletion(
    prompt: string,
    options: GenerateCompletionOptions = {}
  ): Promise<CompletionResponse> {
    return apiClient.request<CompletionResponse>('/ai/generate', {
      method: 'POST',
      signal: options.signal,
      body: JSON.stringify({
        prompt,
        systemPrompt: options.systemPrompt || 'You are Zunme AI, an expert agentic intelligence system.',
        model: options.model,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 2048,
        webSearch: options.webSearch ?? false,
        context: options.context
      })
    });
  }

  /**
   * Foundation helper for upcoming AI Lytics Office modules
   */
  public async prepareOfficeDraft(params: {
    documentType: 'document' | 'spreadsheet' | 'presentation';
    instructions: string;
    model?: string;
    context?: string;
  }): Promise<CompletionResponse> {
    const systemPrompts: Record<string, string> = {
      spreadsheet: 'You are AI Lytics Spreadsheet Engine. Generate structured tabular worksheets with headers, formula columns, and summary rows.',
      presentation: 'You are AI Lytics Presentation Engine. Output structured presentation slide decks with title, bullets, speaker notes, and layout guidance.',
      document: 'You are AI Lytics Office Document Studio. Output professional executive memos, project plans, and structured documents with markdown formatting.'
    };

    let userPrompt = params.instructions;
    if (params.context) {
      userPrompt += `\n\n[CONTEXT / REFERENCE DATA]:\n${params.context}`;
    }

    return this.generateCompletion(userPrompt, {
      systemPrompt: systemPrompts[params.documentType] || systemPrompts.document,
      model: params.model
    });
  }

  /**
   * Foundation helper for upcoming EgoLytics Charts modules
   */
  public async prepareChartSpec(params: {
    chartType: 'bar' | 'line' | 'pie' | 'area' | 'xy' | 'radar';
    tabularData: string | Record<string, unknown>[];
    instructions?: string;
    model?: string;
  }): Promise<CompletionResponse> {
    const systemPrompt = [
      'You are EgoLytics Charts Engine.',
      'Analyze the provided tabular data and output a JSON chart specification with fields: title, chartType, xAxisKey, series, and data points array.',
      'Ensure valid JSON only with no trailing commentary.'
    ].join(' ');

    const userPrompt = [
      `Chart Type: ${params.chartType}`,
      params.instructions ? `Instructions: ${params.instructions}` : '',
      `Data:\n${typeof params.tabularData === 'string' ? params.tabularData : JSON.stringify(params.tabularData)}`
    ].filter(Boolean).join('\n\n');

    return this.generateCompletion(userPrompt, {
      systemPrompt,
      model: params.model
    });
  }
}

export const aiService = new AiService();
