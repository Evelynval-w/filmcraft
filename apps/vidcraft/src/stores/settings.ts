export type Provider = "anthropic" | "google";

export type AnthropicModel =
  | "claude-sonnet-5-5"
  | "claude-haiku-5-5"
  | "claude-opus-5-5";

export type GoogleModel =
  | "gemini-3.8-flash"
  | "gemini-3.8-pro"
  | "gemini-flash-latest";

export type Settings = {
  provider: Provider;
  anthropicApiKey: string;
  anthropicModel: AnthropicModel;
  googleApiKey: string;
  googleModel: GoogleModel;
};

const STORAGE_KEY = "vidcraft.settings.v1";

const DEFAULTS: Settings = {
  provider: "google",
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-5-5",
  googleApiKey: "",
  googleModel: "gemini-3.8-flash",
};

type LegacySettings = Partial<Settings> & {
  /** v0 key before multi-provider; was always Anthropic's. */
  daraModel?: AnthropicModel;
};

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as LegacySettings;
    const anthropicModel = isAnthropicModel(parsed.anthropicModel)
      ? parsed.anthropicModel
      : isAnthropicModel(parsed.daraModel)
        ? parsed.daraModel
        : DEFAULTS.anthropicModel;
    return {
      provider: isProvider(parsed.provider)
        ? parsed.provider
        : parsed.anthropicApiKey
          ? "anthropic"
          : DEFAULTS.provider,
      anthropicApiKey:
        typeof parsed.anthropicApiKey === "string"
          ? parsed.anthropicApiKey
          : "",
      anthropicModel,
      googleApiKey:
        typeof parsed.googleApiKey === "string" ? parsed.googleApiKey : "",
      googleModel: isGoogleModel(parsed.googleModel)
        ? parsed.googleModel
        : DEFAULTS.googleModel,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage disabled; in-memory for this session
  }
  return next;
}

function isProvider(v: unknown): v is Provider {
  return v === "anthropic" || v === "google";
}

function isAnthropicModel(v: unknown): v is AnthropicModel {
  return (
    v === "claude-sonnet-5-5" ||
    v === "claude-haiku-5-5" ||
    v === "claude-opus-5-5"
  );
}

function isGoogleModel(v: unknown): v is GoogleModel {
  return (
    v === "gemini-3.8-flash" ||
    v === "gemini-3.8-pro" ||
    v === "gemini-flash-latest"
  );
}
