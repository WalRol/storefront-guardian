import { RecordingProvider, ReplayProvider } from './cassette';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { OpenAICompatibleProvider } from './openai-compatible';
import type { LlmProvider } from './provider';

export type ProviderName = 'gemini' | 'groq' | 'ollama' | 'replay' | 'none';
export const PROVIDERS: ProviderName[] = ['gemini', 'groq', 'ollama', 'replay', 'none'];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  return value;
}

/** Devuelve null para "none": el pipeline corre solo la capa determinística. */
export function createProvider(
  name: ProviderName,
  opts: { cassetteDir: string; record: boolean },
): LlmProvider | null {
  let provider: LlmProvider;
  switch (name) {
    case 'none':
      return null;
    case 'gemini':
      provider = new GeminiProvider(
        requireEnv('GEMINI_API_KEY'),
        process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      );
      break;
    case 'groq':
      provider = new OpenAICompatibleProvider(
        'groq',
        'https://api.groq.com/openai/v1',
        requireEnv('GROQ_API_KEY'),
        process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      );
      break;
    case 'ollama':
      provider = new OllamaProvider(
        process.env.OLLAMA_URL ?? 'http://localhost:11434',
        process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b',
      );
      break;
    case 'replay':
      return new ReplayProvider(opts.cassetteDir);
    default:
      throw new Error(`Proveedor desconocido: ${name satisfies never}`);
  }
  return opts.record ? new RecordingProvider(provider, opts.cassetteDir) : provider;
}

export type { LlmProvider } from './provider';
