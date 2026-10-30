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

  constructor(
    apiKeyProvider: () => string | undefined,
    modelNameProvider: () => string = () => 'gemini-1.5-flash'
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
    timeoutMs: number = 10000
  ): Promise<string> {
    const apiKey = this.apiKeyProvider();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const model = this.modelNameProvider();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        role: 'system',
        parts: [{ text: systemInstruction }],
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Gemini API HTTP ${response.status} (${response.statusText}): ${errorText.substring(0, 200)}`
        );
      }

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text || typeof text !== 'string') {
        throw new Error('Gemini returned an empty or invalid candidate content');
      }

      return text;
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw new Error(`Gemini API request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
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

