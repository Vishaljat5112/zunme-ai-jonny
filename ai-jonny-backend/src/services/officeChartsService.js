/**
 * Reusable AI Foundation & Storage Service for Upcoming AI Lytics Office and EgoLytics Charts Modules.
 * Provides validation, structured prompt engineering, and local asset persistence
 * without requiring external cloud infrastructure.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getPool } from '../db/pool.js';
import { config } from '../config/index.js';
import { getAiProvider } from './ai/index.js';

export class OfficeChartsService {
  /**
   * Validate tabular data structure (CSV/JSON/Array of records)
   */
  static validateTabularData(data) {
    if (!data) return { valid: false, error: 'Data cannot be empty' };
    if (Array.isArray(data)) {
      if (data.length === 0) return { valid: false, error: 'Array is empty' };
      const sample = data[0];
      if (typeof sample !== 'object' || sample === null) {
        return { valid: false, error: 'Array items must be JSON objects/rows' };
      }
      const columns = Object.keys(sample);
      return { valid: true, columns, rowCount: data.length };
    }
    if (typeof data === 'string') {
      const lines = data.trim().split(/\r?\n/);
      if (lines.length < 2) return { valid: false, error: 'Tabular string must have a header row and at least one data row' };
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const columns = lines[0].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
      return { valid: true, columns, rowCount: lines.length - 1 };
    }
    return { valid: false, error: 'Unsupported tabular data format' };
  }

  /**
   * Format a system prompt tailored for EgoLytics Charts generation
   */
  static buildChartSystemPrompt() {
    return [
      'You are EgoLytics Charts Engine, specialized in data visualization, financial analytics, and chart structuring.',
      'Always respond with a valid JSON specification containing: title, chartType (bar, line, pie, area, radar, xy), xAxisKey, series, and data points array.',
      'Ensure numerical precision, clean axis labels, and high contrast palette tokens.'
    ].join('\n');
  }

  /**
   * Format a system prompt tailored for AI Lytics Office document & spreadsheet creation
   */
  static buildOfficeSystemPrompt(documentType = 'document') {
    if (documentType === 'spreadsheet') {
      return [
        'You are AI Lytics Spreadsheet Engine.',
        'Generate structured tabular worksheets with formulas, headers, column types, and statistical summaries.',
        'Output valid markdown tables and JSON row models.'
      ].join('\n');
    }
    if (documentType === 'presentation') {
      return [
        'You are AI Lytics Presentation Engine.',
        'Structure outputs into distinct slide objects containing: slideNumber, title, bullets, presenterNotes, and layout.'
      ].join('\n');
    }
    return [
      'You are AI Lytics Office Document Studio.',
      'Draft publication-ready business documents, memos, proposals, and SOPs with semantic headers, executive summaries, action items, and tables.'
    ].join('\n');
  }

  /**
   * Generates chart data using the active AI provider
   */
  static async generateChartSpec({ prompt, tabularContext, model }) {
    const provider = getAiProvider();
    const systemPrompt = this.buildChartSystemPrompt();
    let userPrompt = prompt;
    if (tabularContext) {
      userPrompt += `\n\n[INPUT DATA]:\n${typeof tabularContext === 'string' ? tabularContext : JSON.stringify(tabularContext)}`;
    }

    const res = await provider.generateResponse({
      model: model || config.ai.ollamaDefaultModel || 'gemma3:4b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false
    });

    const content = typeof res === 'string' ? res : (res?.content || '');
    return {
      spec: content,
      model: model || provider.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Persists an Office document or Chart artifact into user library (local MySQL persistence)
   */
  static async persistOfficeAsset({
    userId,
    title,
    contentType, // 'OFFICE' | 'CHART' | 'TEXT'
    content,
    previewText,
    folderId = null,
    sourceMetadata = null,
    tags = []
  }) {
    if (!userId || !title || !content) {
      throw new Error('userId, title, and content are required');
    }

    const pool = getPool();
    const id = 'off_' + crypto.randomBytes(6).toString('hex');
    const safePreview = previewText || content.slice(0, 160) + '...';
    const metaStr = sourceMetadata ? JSON.stringify(sourceMetadata) : null;
    const tagsStr = tags && tags.length ? JSON.stringify(tags) : JSON.stringify([contentType || 'OFFICE']);

    await pool.query(
      `INSERT INTO library_items (id, user_id, folder_id, title, content_type, content, preview_text, source_metadata, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, folderId, title, contentType || 'OFFICE', content, safePreview, metaStr, tagsStr]
    );

    return {
      id,
      userId,
      title,
      contentType: contentType || 'OFFICE',
      content,
      previewText: safePreview,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Write an exported document or chart file to local storage (uploads directory)
   */
  static async exportLocalFile({ filename, content, subfolder = 'office_exports' }) {
    const targetDir = path.join(config.upload.dir, subfolder);
    await fs.mkdir(targetDir, { recursive: true });

    const safeFilename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(targetDir, safeFilename);

    await fs.writeFile(filePath, content, 'utf8');

    return {
      filename: safeFilename,
      path: filePath,
      size: Buffer.byteLength(content, 'utf8'),
      createdAt: new Date().toISOString()
    };
  }
}
