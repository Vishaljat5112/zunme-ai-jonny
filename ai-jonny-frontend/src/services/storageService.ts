/**
 * Reusable Local File and Asset Storage Foundation for Zunme AI.
 * Backed by centralized API client, local filesystem storage, and MySQL library tables.
 * Prepared for upcoming AI Lytics Office files and EgoLytics Charts export files.
 */

import { apiClient, AttachmentItem } from './apiClient';
import { SavedLibraryItem } from '../types';

export class StorageService {
  /**
   * Upload one or multiple files attached to a conversation or workspace
   */
  public async uploadFiles(conversationId: string, files: File[]): Promise<AttachmentItem[]> {
    return apiClient.uploadFiles(conversationId, files);
  }

  /**
   * Generate authenticated/accessible download URL for a file
   */
  public getFileUrl(attachmentId: string): string {
    return apiClient.getAttachmentUrl(attachmentId);
  }

  /**
   * Delete an uploaded file attachment
   */
  public async deleteFile(attachmentId: string): Promise<void> {
    return apiClient.deleteAttachment(attachmentId);
  }

  /**
   * Save an AI Lytics Office document asset into the user's saved library
   */
  public async saveOfficeAsset(params: {
    title: string;
    content: string;
    documentType?: 'DOCUMENT' | 'SPREADSHEET' | 'PRESENTATION';
    previewText?: string;
    tags?: string[];
  }): Promise<SavedLibraryItem> {
    return apiClient.createLibraryItem({
      title: params.title,
      contentType: 'OFFICE',
      content: params.content,
      previewText: params.previewText || params.content.slice(0, 140) + '...',
      tags: params.tags || ['Office', params.documentType || 'DOCUMENT']
    });
  }

  /**
   * Save an EgoLytics Chart specification/dataset into the user's saved library
   */
  public async saveChartAsset(params: {
    title: string;
    chartSpecJson: string;
    chartType?: string;
    previewText?: string;
    tags?: string[];
  }): Promise<SavedLibraryItem> {
    // Validate JSON before sending
    try {
      JSON.parse(params.chartSpecJson);
    } catch {
      throw new Error('Invalid chart specification JSON format.');
    }

    return apiClient.createLibraryItem({
      title: params.title.trim() || 'Untitled Diagram',
      contentType: 'CHART',
      content: params.chartSpecJson,
      previewText: params.previewText || `EgoLytics ${params.chartType || 'Data'} Chart Specification`,
      tags: params.tags || ['Chart', 'EgoLytics', params.chartType || 'Chart']
    });
  }

  /**
   * Fetch a single saved chart asset by ID
   */
  public async getChartAsset(id: string): Promise<SavedLibraryItem | null> {
    try {
      return await apiClient.getLibraryItem(id);
    } catch (err) {
      console.warn(`[StorageService] Failed to load chart asset ${id}:`, err);
      return null;
    }
  }

  /**
   * Update an existing chart asset in-place without creating duplicates
   */
  public async updateChartAsset(
    id: string,
    params: {
      title?: string;
      chartSpecJson?: string;
      chartType?: string;
      previewText?: string;
      tags?: string[];
    }
  ): Promise<void> {
    if (params.chartSpecJson) {
      try {
        JSON.parse(params.chartSpecJson);
      } catch {
        throw new Error('Invalid chart specification JSON format.');
      }
    }

    await apiClient.updateLibraryItem(id, {
      title: params.title ? params.title.trim() : undefined,
      content: params.chartSpecJson,
      previewText: params.previewText,
      tags: params.tags
    });
  }

  /**
   * Rename an existing chart asset directly
   */
  public async renameChartAsset(id: string, newTitle: string): Promise<void> {
    const trimmed = newTitle.trim();
    if (!trimmed) throw new Error('Chart title cannot be empty.');
    await apiClient.updateLibraryItem(id, { title: trimmed });
  }

  /**
   * Duplicate an existing chart asset into a new record
   */
  public async duplicateChartAsset(id: string): Promise<SavedLibraryItem> {
    const original = await this.getChartAsset(id);
    if (!original) throw new Error('Original chart not found or unauthorized.');

    const newTitle = `${original.title} (Copy)`;
    return this.saveChartAsset({
      title: newTitle,
      chartSpecJson: original.content,
      previewText: original.previewText,
      tags: original.tags
    });
  }

  /**
   * List saved library assets with category or search filter
   */
  public async listAssets(category?: string, search?: string): Promise<SavedLibraryItem[]> {
    return apiClient.getLibraryItems(category, search);
  }

  /**
   * Delete a saved asset from the library
   */
  public async deleteAsset(id: string): Promise<void> {
    return apiClient.deleteLibraryItem(id);
  }
}

export const storageService = new StorageService();
