import Anthropic from "@anthropic-ai/sdk";

function createClient(): Anthropic {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

let _client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!_client) {
    _client = createClient();
  }
  return _client;
}

export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop: string | symbol) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
