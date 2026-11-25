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
    return apiClient.createLibraryItem({
      title: params.title,
      contentType: 'CHART',
      content: params.chartSpecJson,
      previewText: params.previewText || `EgoLytics ${params.chartType || 'Data'} Chart Specification`,
      tags: params.tags || ['Chart', 'EgoLytics', params.chartType || 'Chart']
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
