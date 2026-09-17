/**
 * AI Insight configuration — runtime values via connector-settings-store.
 */

import {
  getAiSettings,
  isLlmConfigured as storeIsLlmConfigured,
} from "@/data/connector-settings-store";

export { AI_MODEL_PRESETS } from "@/config/ai-models";

/** @deprecated Prefer getAiSettings() — kept for compatibility. */
export const AI_CONFIG = {
  get enabled() {
    return getAiSettings().enabled;
  },
  get provider() {
    return getAiSettings().provider;
  },
  get apiKey() {
    return getAiSettings().apiKey;
  },
  get model() {
    return getAiSettings().model;
  },
  get endpoint() {
    return getAiSettings().endpoint;
  },
};

export function isLlmConfigured(): boolean {
  return storeIsLlmConfigured();
}
