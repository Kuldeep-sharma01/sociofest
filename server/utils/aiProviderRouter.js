import axios from "axios";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CircuitBreaker {
  constructor() {
    this.failures = new Map();
  }

  isOpen(key) {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (Date.now() > entry.openUntil) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= 3;
  }

  recordFailure(key) {
    const prev = this.failures.get(key) || { count: 0, openUntil: 0 };
    const count = prev.count + 1;
    const openUntil = count >= 3 ? Date.now() + 30_000 : 0;
    this.failures.set(key, { count, openUntil });
  }

  recordSuccess(key) {
    this.failures.delete(key);
  }
}

const breaker = new CircuitBreaker();
const responseCache = new Map();

const getCacheKey = (node, prompt) => `${node.provider}:${node.model}:${prompt}`;

const getApiKey = (provider) => {
  const keyMap = {
    openai: process.env.OPENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  return keyMap[provider];
};

const callProvider = async (node, payload, signal) => {
  const timeoutMs = node.timeoutMs || 20_000;
  if (node.provider === "openai") {
    const apiKey = getApiKey("openai");
    if (!apiKey) throw new Error("openai_not_configured");
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: node.model,
        messages: payload.messages,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: timeoutMs,
        signal,
      },
    );
    return res.data?.choices?.[0]?.message?.content || "";
  }

  if (node.provider === "deepseek") {
    const apiKey = getApiKey("deepseek");
    if (!apiKey) throw new Error("deepseek_not_configured");
    const res = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: node.model,
        messages: payload.messages,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: timeoutMs,
        signal,
      },
    );
    return res.data?.choices?.[0]?.message?.content || "";
  }

  if (node.provider === "openrouter") {
    const apiKey = getApiKey("openrouter");
    if (!apiKey) throw new Error("openrouter_not_configured");
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: node.model,
        messages: payload.messages,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: timeoutMs,
        signal,
      },
    );
    return res.data?.choices?.[0]?.message?.content || "";
  }

  throw new Error(`unsupported_provider:${node.provider}`);
};

export const runWithFallbackChain = async (chain, payload, signal) => {
  const errors = [];
  const prompt = payload.messages?.map((m) => m.content).join("\n") || "";

  for (const node of chain) {
    if (!node?.enabled) continue;
    const key = `${node.provider}:${node.model}`;
    const cacheKey = getCacheKey(node, prompt);

    if (breaker.isOpen(key)) {
      const cached = responseCache.get(cacheKey);
      if (cached) {
        return {
          text: cached.text,
          provider: node.provider,
          model: node.model,
          fallbackUsed: true,
          cached: true,
        };
      }
      errors.push(`${key}:circuit_open`);
      continue;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await callProvider(node, payload, signal);
        breaker.recordSuccess(key);
        responseCache.set(cacheKey, { text, createdAt: Date.now() });
        return {
          text,
          provider: node.provider,
          model: node.model,
          fallbackUsed: errors.length > 0,
          cached: false,
        };
      } catch (error) {
        breaker.recordFailure(key);
        const errMsg = error?.response?.data?.error?.message || error.message;
        errors.push(`${key}:${errMsg}`);
        if (attempt === 0) {
          await sleep(250 + Math.floor(Math.random() * 500));
        }
      }
    }
  }

  const lastCache = [...responseCache.values()].slice(-1)[0];
  if (lastCache) {
    return {
      text: lastCache.text,
      provider: "cache",
      model: "cached-fallback",
      fallbackUsed: true,
      cached: true,
    };
  }

  throw new Error(`all_fallbacks_failed:${errors.join("|")}`);
};
