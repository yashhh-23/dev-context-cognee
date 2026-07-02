import * as vscode from 'vscode';
import { getCogneeApiKey, promptAndStoreCogneeApiKey } from './tokenManager';

export type ApiClientOptions = {
  context: vscode.ExtensionContext;
};

export type RecallRequest = {
  query: string;
  languageId: string;
  similarityThreshold: number;
};

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private get backendUrl(): string {
    const url = vscode.workspace
      .getConfiguration('devContext')
      .get<string>('backendUrl', '');

    if (!url || url === 'https://your-backend.onrender.com') {
      throw new Error('Backend URL not configured. Update Dev-Context Assistant settings.');
    }

    return url.replace(/\/$/, '');
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    retryCount = 0
  ): Promise<T> {
    const headers = new Headers(init.headers ?? {});
    headers.set('Content-Type', 'application/json');

    const apiKey = await getCogneeApiKey(this.options.context);
    if (apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`);
    }

    try {
      const response = await fetch(`${this.backendUrl}${path}`, {
        ...init,
        headers
      });

      if (response.status === 401 && retryCount === 0) {
        const refreshedKey = await promptAndStoreCogneeApiKey(this.options.context);
        if (!refreshedKey) {
          throw new Error('Authentication required. Cognee API key was not provided.');
        }

        const retryHeaders = new Headers(init.headers ?? {});
        retryHeaders.set('Content-Type', 'application/json');
        retryHeaders.set('Authorization', `Bearer ${refreshedKey}`);

        const retryResponse = await fetch(`${this.backendUrl}${path}`, {
          ...init,
          headers: retryHeaders
        });

        if (!retryResponse.ok) {
          throw await this.buildError(retryResponse);
        }

        return (await retryResponse.json()) as T;
      }

      if (!response.ok) {
        throw await this.buildError(response);
      }

      const text = await response.text();
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch (error) {
      if (retryCount < 2 && this.shouldRetry(error)) {
        await this.delay(1000 * (retryCount + 1));
        return this.request<T>(path, init, retryCount + 1);
      }
      throw error;
    }
  }

  async post<T>(path: string, body: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async ingestContext(payload: {
    content: string;
    fileName: string;
    languageId: string;
    source: string;
    symbols?: string[];
  }) {
    return this.request('/api/ingest', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async recallSimilarBugs(payload: RecallRequest) {
    // route matches backend: app.include_router(recall.router, prefix="/api/recall")
    return this.request<{ bugs?: unknown[] }>('/api/recall', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async draftIssue(payload: {
    fileName: string;
    languageId: string;
    codeSnippet: string;
  }) {
    return this.request<{ title?: string; body?: string }>('/api/bugs/draft-issue', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async startSession(payload: { sessionId: string; workspaceName: string }) {
    return this.request<{ status: string }>('/api/session/start', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async endSession(payload: { sessionId: string; triggerDistillation: boolean }) {
    return this.request<{ status: string }>('/api/session/end', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async submitFeedback(payload: { qaId: string; score: number; sessionId: string }) {
    return this.request<{ status: string }>('/api/recall/feedback', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async healthCheck() {
    return this.request<{ status?: string }>('/health', {
      method: 'GET'
    });
  }

  private async buildError(response: Response): Promise<Error> {
    const raw = await response.text();
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { detail?: string; message?: string };
      detail = parsed.detail ?? parsed.message ?? raw;
    } catch {
    }
    return new Error(`HTTP ${response.status}: ${detail || response.statusText}`);
  }

  private shouldRetry(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset')
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
