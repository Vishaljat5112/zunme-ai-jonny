import { getAiProvider } from '../services/ai/index.js';

export class AiGenerateController {
  /**
   * Unified AI Generation Endpoint: POST /api/ai/generate
   * Generates dynamic content, code, custom agent outputs, SEO blueprints, or spreadsheet analytics
   * powered by xAI Grok / active AI provider.
   */
  static async generate(req, res, next) {
    try {
      const {
        prompt,
        systemPrompt = 'You are Zunme AI, an expert agentic intelligence system.',
        model,
        temperature = 0.7,
        maxTokens = 2048,
        webSearch = false
      } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'A valid text prompt is required.' });
      }

      const provider = getAiProvider();
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.trim() }
      ];

      const rawResponse = await provider.generateResponse({
        model,
        messages,
        webSearch,
        stream: false
      });

      const content = typeof rawResponse === 'string' ? rawResponse : (rawResponse?.content || '');
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

      return res.json({
        success: true,
        content,
        wordCount,
        model: model || provider.name,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[AiGenerateController] Error generating content:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Internal AI generation failure.'
      });
    }
  }
}

