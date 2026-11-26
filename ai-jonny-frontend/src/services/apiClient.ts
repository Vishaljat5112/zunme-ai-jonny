/**
 * Centralized API Client for Zunme AI Frontend
 * Provides authenticated HTTP transport with environment configuration,
 * token persistence in localStorage, and typed response handling.
 */

import { Conversation, ChatMessage, SavedLibraryItem } from '../types';

export const AUTH_TOKEN_KEY = 'zunme_auth_token';

export interface AttachmentItem {
  id: string;
  conversation_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  url: string;
  created_at?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  tag?: string;
  priority?: number;
}

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  avatar_initials?: string;
  plan_badge?: string;
  created_at?: string;
}

export interface AuthApiResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: BackendUser;
  error?: string;
}

export interface MeApiResponse {
  success: boolean;
  authenticated: boolean;
  user: BackendUser | null;
  isGuest: boolean;
  error?: string;
}

export interface RoleCheckResponse {
  success: boolean;
  authorized: boolean;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  error?: string;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    const envObj = (import.meta as unknown as { env?: Record<string, string> }).env;
    this.baseUrl = (envObj?.VITE_API_URL) || 'http://localhost:5000/api';
    // Remove trailing slash if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getToken(): string | null {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public setToken(token: string): void {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch (err) {
      console.warn('Unable to persist token in localStorage:', err);
    }
  }

  public removeToken(): void {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (err) {
      console.warn('Unable to clear token from localStorage:', err);
    }
  }

  /**
   * Generic authenticated HTTP request
   */
  public async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg =
        (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string')
          ? (data as { error: string }).error
          : response.statusText || `Request failed with status ${response.status}`;

      // Automatically purge invalid/expired tokens on 401
      if (response.status === 401 && token) {
        this.removeToken();
      }

      throw new ApiError(errorMsg, response.status, data);
    }

    return data as T;
  }

  // --- Authentication Endpoints ---

  public async login(email: string, pass: string): Promise<AuthApiResponse> {
    const res = await this.request<AuthApiResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password: pass })
    });

    if (res.success && res.token) {
      this.setToken(res.token);
    }

    return res;
  }

  public async personaLogin(roleOrPersona: string): Promise<AuthApiResponse> {
    const res = await this.request<AuthApiResponse>('/auth/persona-login', {
      method: 'POST',
      body: JSON.stringify({ persona: roleOrPersona, role: roleOrPersona })
    });

    if (res.success && res.token) {
      this.setToken(res.token);
    }

    return res;
  }

  public async register(name: string, email: string, pass: string): Promise<AuthApiResponse> {
    const res = await this.request<AuthApiResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password: pass })
    });

    if (res.success && res.token) {
      this.setToken(res.token);
    }

    return res;
  }

  public async getMe(): Promise<MeApiResponse> {
    return this.request<MeApiResponse>('/auth/me', {
      method: 'GET'
    });
  }

  public async checkAdminRole(): Promise<RoleCheckResponse> {
    return this.request<RoleCheckResponse>('/auth/admin-check', {
      method: 'GET'
    });
  }

  public async checkSuperAdminRole(): Promise<RoleCheckResponse> {
    return this.request<RoleCheckResponse>('/auth/superadmin-check', {
      method: 'GET'
    });
  }

  public logout(): void {
    this.removeToken();
  }

  // --- Conversations Endpoints ---

  public async getConversations(): Promise<Conversation[]> {
    const res = await this.request<{ success: boolean; conversations: Array<{ id: string; title: string; created_at: string; updated_at: string }> }>('/conversations', {
      method: 'GET'
    });
    return (res.conversations || []).map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));
  }

  public async createConversation(id?: string, title?: string, model?: string): Promise<Conversation> {
    const res = await this.request<{ success: boolean; conversation: { id: string; title: string; created_at: string; updated_at: string } }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ id, title: title || 'New Conversation', model })
    });
    return {
      id: res.conversation.id,
      title: res.conversation.title,
      createdAt: res.conversation.created_at,
      updatedAt: res.conversation.updated_at
    };
  }

  public async deleteConversation(id: string): Promise<void> {
    await this.request(`/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  // --- Messages & Streaming Endpoints ---

  public async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const res = await this.request<{
      success: boolean;
      messages: Array<{
        id: string;
        conversation_id: string;
        role: 'user' | 'assistant';
        content: string;
        status?: string;
        model?: string;
        created_at: string;
      }>;
    }>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'GET'
    });

    return (res.messages || []).map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      status: (m.status as ChatMessage['status']) || 'completed',
      model: m.model
    }));
  }

  /**
   * SSE Streaming Message Dispatcher
   */
  public async sendMessageStream({
    conversationId,
    content,
    model,
    attachmentIds = [],
    webSearch = false,
    history = [],
    onChunk,
    onDone,
    onError,
    signal
  }: {
    conversationId: string;
    content: string;
    model?: string;
    attachmentIds?: string[];
    webSearch?: boolean;
    history?: Array<{ role: string; content: string }>;
    onChunk?: (delta: string) => void;
    onDone?: (message: ChatMessage) => void;
    onError?: (err: string) => void;
    signal?: AbortSignal;
  }): Promise<ChatMessage> {
    const url = `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/messages`;
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        model,
        stream: true,
        attachmentIds,
        webSearch,
        history
      }),
      signal
    });

    if (!response.ok) {
      let errText = response.statusText;
      try {
        const errJson = await response.json();
        errText = errJson.error || errText;
      } catch {}
      throw new ApiError(errText, response.status);
    }

    if (!response.body) {
      throw new ApiError('Response body is null', 500);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = '';
    let buffer = '';
    let completedMessage: ChatMessage | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.replace('event:', '').trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.replace('data:', '').trim();
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === 'chunk' && data.delta) {
                accumulatedContent += data.delta;
                onChunk?.(data.delta);
              } else if (currentEvent === 'done' && data.message) {
                completedMessage = {
                  id: data.message.id || `msg_a_${Date.now()}`,
                  conversationId,
                  role: 'assistant',
                  content: data.message.content || accumulatedContent,
                  createdAt: data.message.created_at || new Date().toISOString(),
                  status: 'completed',
                  model: data.message.model || model
                };
                onDone?.(completedMessage);
              } else if (currentEvent === 'error') {
                const errMsg = data.error || 'AI generation error';
                onError?.(errMsg);
              }
            } catch {}
          }
        }
      }
    } catch (readErr: unknown) {
      if ((readErr as Error)?.name === 'AbortError') {
        console.warn('Stream generation aborted by user.');
      } else {
        onError?.((readErr as Error)?.message || 'Stream read error');
        throw readErr;
      }
    }

    return (
      completedMessage || {
        id: `msg_a_${Date.now()}`,
        conversationId,
        role: 'assistant',
        content: accumulatedContent,
        createdAt: new Date().toISOString(),
        status: 'completed',
        model
      }
    );
  }

  // --- Attachments & File Upload Endpoints ---

  public async uploadFiles(conversationId: string, files: File[]): Promise<AttachmentItem[]> {
    const formData = new FormData();
    formData.append('conversationId', conversationId);
    for (const file of files) {
      formData.append('files', file);
    }

    const res = await this.request<{ success: boolean; attachments: AttachmentItem[] }>('/attachments/upload', {
      method: 'POST',
      body: formData
    });

    return res.attachments || [];
  }

  public getAttachmentUrl(id: string): string {
    return `${this.baseUrl}/attachments/${encodeURIComponent(id)}/file`;
  }

  public async deleteAttachment(id: string): Promise<void> {
    await this.request(`/attachments/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  // --- Saved Library Endpoints ---

  public async getLibraryItems(category?: string, search?: string): Promise<SavedLibraryItem[]> {
    const params = new URLSearchParams();
    if (category && category !== 'ALL') params.append('category', category);
    if (search && search.trim()) params.append('search', search.trim());
    const queryStr = params.toString() ? `?${params.toString()}` : '';

    const res = await this.request<{ success: boolean; items: Array<{
      id: string;
      title: string;
      contentType: string;
      content: string;
      previewText: string;
      folderId?: string | null;
      sourceMetadata?: unknown;
      tags?: string[];
      createdAt: string;
    }> }>(`/library${queryStr}`, {
      method: 'GET'
    });

    return (res.items || []).map((it) => ({
      id: it.id,
      title: it.title,
      contentType: it.contentType,
      content: it.content,
      previewText: it.previewText,
      folderId: it.folderId,
      sourceMetadata: it.sourceMetadata as SavedLibraryItem['sourceMetadata'],
      tags: it.tags || [],
      createdAt: it.createdAt
    }));
  }

  public async getLibraryItem(id: string): Promise<SavedLibraryItem> {
    const res = await this.request<{ success: boolean; item: SavedLibraryItem }>(`/library/${encodeURIComponent(id)}`, {
      method: 'GET'
    });
    return res.item;
  }

  public async createLibraryItem(item: Omit<SavedLibraryItem, 'id' | 'createdAt'>): Promise<SavedLibraryItem> {
    const res = await this.request<{ success: boolean; item: SavedLibraryItem }>('/library', {
      method: 'POST',
      body: JSON.stringify(item)
    });
    return res.item;
  }

  public async updateLibraryItem(
    id: string,
    updates: Partial<Pick<SavedLibraryItem, 'title' | 'content' | 'previewText' | 'folderId' | 'tags' | 'sourceMetadata'>>
  ): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(`/library/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  public async deleteLibraryItem(id: string): Promise<void> {
    await this.request(`/library/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  // --- AI Models & System Metadata ---

  public async getModels(): Promise<{ provider: string; available: boolean; models: ModelInfo[] }> {
    return this.request<{ provider: string; available: boolean; models: ModelInfo[] }>('/models', {
      method: 'GET'
    });
  }

  // --- EgoLytics BFOV Charts Admin & Module Controls ---

  public async getChartsStats(): Promise<{
    success: boolean;
    stats: {
      totalCharts: number;
      uniqueCreators: number;
      lastCreatedAt: string | null;
      modeBreakdown: Record<string, number>;
      recentCharts: Array<{
        id: string;
        userId: string;
        title: string;
        diagramMode?: string;
        nodeCount?: number;
        edgeCount?: number;
        createdAt: string;
      }>;
    };
  }> {
    return this.request('/admin/charts/stats', { method: 'GET' });
  }

  public async getChartsSettings(): Promise<{ success: boolean; settings: { chartsEnabled: boolean } }> {
    return this.request('/admin/charts/settings', { method: 'GET' });
  }

  public async updateChartsSettings(chartsEnabled: boolean): Promise<{ success: boolean; message: string; settings: { chartsEnabled: boolean } }> {
    return this.request('/admin/charts/settings', {
      method: 'PATCH',
      body: JSON.stringify({ chartsEnabled })
    });
  }

  public async getChartsStatus(): Promise<{ success: boolean; enabled: boolean; module: string }> {
    return this.request('/charts/status', { method: 'GET' });
  }
}

export const apiClient = new ApiClient();
