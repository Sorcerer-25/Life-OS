/**
 * LLM Provider interface and implementations.
 * Keeps provider-specific HTTP/API code decoupled from intent identification logic.
 */

export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  generate(prompt: string, systemInstruction?: string, timeoutMs?: number): Promise<string>;
}

export class GeminiProvider implements LlmProvider {
  public readonly name = 'Google Gemini';
  private apiKeyProvider: () => string | undefined;
  private modelNameProvider: () => string;
  private discoveredWorkingModel?: string;

  constructor(
    apiKeyProvider: () => string | undefined,
    modelNameProvider: () => string = () => 'gemini-3.8-flash'
  ) {
    this.apiKeyProvider = apiKeyProvider;
    this.modelNameProvider = modelNameProvider;
  }

  public isConfigured(): boolean {
    const key = this.apiKeyProvider();
    return Boolean(key && key.trim().length > 5);
  }

  public async generate(
    prompt: string,
    systemInstruction?: string,
    timeoutMs: number = 45000
  ): Promise<string> {
    const apiKey = this.apiKeyProvider();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const preferredModel = (this.discoveredWorkingModel || this.modelNameProvider()).replace(
      /^models\//,
      ''
    );

    try {
      return await this.callGenerateContent(preferredModel, apiKey, prompt, systemInstruction, timeoutMs);
    } catch (err: unknown) {
      const errMsg = (err as Error).message || String(err);

      // 1. Check if Google API suggests a specific replacement model in the error message
      const suggestedMatch = errMsg.match(/use models\/\s*([a-zA-Z0-9\.\-_]+)/i);
      if (suggestedMatch) {
        const suggestedModel = suggestedMatch[1].trim();
        this.discoveredWorkingModel = suggestedModel;
        return await this.callGenerateContent(suggestedModel, apiKey, prompt, systemInstruction, timeoutMs);
      }

      // 2. Handle HTTP 503 (High Demand / Overloaded) with short backoff and alternate model failover
      if (errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('high demand') || errMsg.includes('429')) {
        // Quick 1.5s backoff retry
        await new Promise((res) => setTimeout(res, 1500));
        try {
          return await this.callGenerateContent(preferredModel, apiKey, prompt, systemInstruction, timeoutMs);
        } catch {
          // If still overloaded, try alternate models
          const alternates = ['gemini-2.5-flash', 'gemini-1.5-flash-latest', 'gemini-3.8-pro'].filter(
            (m) => m !== preferredModel
          );
          for (const alt of alternates) {
            try {
              const res = await this.callGenerateContent(alt, apiKey, prompt, systemInstruction, timeoutMs);
              this.discoveredWorkingModel = alt;
              return res;
            } catch {
              continue;
            }
          }
        }
        throw new Error('Google Gemini is experiencing temporary high demand (503). Used rule-based fallback.');
      }

      // 3. If HTTP 404 or model deprecated/unsupported: auto-discover active models via ListModels!
      if (
        errMsg.includes('404') ||
        errMsg.includes('not found') ||
        errMsg.includes('no longer available') ||
        errMsg.includes('not supported')
      ) {
        const discovered = await this.discoverAvailableModel(apiKey);
        if (discovered && discovered !== preferredModel) {
          this.discoveredWorkingModel = discovered;
          // Retry with discovered model
          return await this.callGenerateContent(discovered, apiKey, prompt, systemInstruction, timeoutMs);
        }
      }

      throw err;
    }
  }

  private async callGenerateContent(
    model: string,
    apiKey: string,
    prompt: string,
    systemInstruction?: string,
    timeoutMs: number = 45000
  ): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const makeRequestBody = (includeThinkingBudget: boolean): Record<string, unknown> => {
      const generationConfig: Record<string, unknown> = {
        temperature: 0.1,
        responseMimeType: 'application/json',
        maxOutputTokens: 1024,
      };

      // Disabling or zeroing thinking budget makes Flash models return JSON in ~1-2 seconds
      // rather than spending 30+ seconds generating hundreds of reasoning tokens.
      if (includeThinkingBudget) {
        generationConfig.thinkingConfig = {
          thinkingBudget: 0,
        };
      }

      const body: Record<string, unknown> = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig,
      };

      if (systemInstruction) {
        body.systemInstruction = {
          role: 'system',
          parts: [{ text: systemInstruction }],
        };
      }

      return body;
    };

    // Try first with thinkingBudget: 0 for fast response. If model doesn't support the field, retry without it.
    let response = await this.executeFetchWithTimeout(
      endpoint,
      makeRequestBody(true),
      timeoutMs
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (errorText.includes('thinkingConfig') || errorText.includes('thinking_config')) {
        // Fallback without thinkingConfig
        response = await this.executeFetchWithTimeout(
          endpoint,
          makeRequestBody(false),
          timeoutMs
        );
      } else {
        throw new Error(
          `Gemini API HTTP ${response.status} (${response.statusText}): ${errorText.substring(0, 250)}`
        );
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Gemini API HTTP ${response.status} (${response.statusText}): ${errorText.substring(0, 250)}`
      );
    }

    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== 'string') {
      throw new Error('Gemini returned an empty or invalid candidate content');
    }

    return text;
  }

  private async executeFetchWithTimeout(
    endpoint: string,
    body: Record<string, unknown>,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || String(err);
      if (
        (err as { name?: string }).name === 'AbortError' ||
        msg.toLowerCase().includes('canceled') ||
        msg.toLowerCase().includes('aborted') ||
        msg.toLowerCase().includes('timeout')
      ) {
        throw new Error(`Gemini API request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Queries Gemini ListModels to find an active model supporting generateContent
   */
  private async discoverAvailableModel(apiKey: string): Promise<string | null> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      const models = (data.models || []) as Array<{
        name: string;
        supportedGenerationMethods?: string[];
      }>;

      // Filter for models supporting generateContent
      const valid = models.filter((m) =>
        m.supportedGenerationMethods?.includes('generateContent')
      );

      if (valid.length === 0) return null;

      // Prefer flash models first, then any gemini model
      const flash = valid.find(
        (m) => m.name.includes('flash') && !m.name.includes('vision') && !m.name.includes('tuning')
      );
      if (flash) {
        return flash.name.replace(/^models\//, '');
      }

      const anyGemini = valid.find((m) => m.name.includes('gemini'));
      if (anyGemini) {
        return anyGemini.name.replace(/^models\//, '');
      }

      return valid[0].name.replace(/^models\//, '');
    } catch {
      return null;
    }
  }
}

/**
 * Mock LLM Provider for deterministic unit testing of retry, fallback, and validation.
 */
export class MockLlmProvider implements LlmProvider {
  public readonly name = 'Mock LLM';
  public configured: boolean = true;
  private responses: Array<() => Promise<string> | string> = [];
  public callCount: number = 0;
  public lastPrompt?: string;

  constructor(responses: Array<() => Promise<string> | string> = []) {
    this.responses = [...responses];
  }

  public enqueueResponse(response: () => Promise<string> | string): void {
    this.responses.push(response);
  }

  public isConfigured(): boolean {
    return this.configured;
  }

  public async generate(prompt: string, _systemInstruction?: string): Promise<string> {
    this.callCount++;
    this.lastPrompt = prompt;

    if (!this.configured) {
      throw new Error('Mock LLM is not configured');
    }

    if (this.responses.length === 0) {
      throw new Error('Mock LLM: No enqueued response available');
    }

    const next = this.responses.shift()!;
    return typeof next === 'function' ? await next() : next;
  }
}
