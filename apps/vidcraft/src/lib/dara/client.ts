import type { DaraAction } from "@/lib/dara/actions";
import type { Settings } from "@/stores/settings";

export type DaraCallResult =
  | { ok: true; actions: DaraAction[] }
  | { ok: false; error: string };

/**
 * Call the configured LLM provider (Anthropic Claude or Google Gemini) with
 * the Dara system prompt and the compact project context, and parse the
 * returned JSON array of actions.
 */
export async function callDara(args: {
  settings: Settings;
  systemPrompt: string;
  userTurn: string;
}): Promise<DaraCallResult> {
  if (args.settings.provider === "anthropic") {
    if (!args.settings.anthropicApiKey) {
      return {
        ok: false,
        error: "No Anthropic API key. Add one in Settings or switch provider.",
      };
    }
    return callAnthropic(
      args.settings.anthropicApiKey,
      args.settings.anthropicModel,
      args.systemPrompt,
      args.userTurn,
    );
  }
  if (!args.settings.googleApiKey) {
    return {
      ok: false,
      error: "No Google AI API key. Add one in Settings or switch provider.",
    };
  }
  return callGemini(
    args.settings.googleApiKey,
    args.settings.googleModel,
    args.systemPrompt,
    args.userTurn,
  );
}

// --- Anthropic ---

type AnthropicContentBlock = { type: string; text?: string };
type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
};

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userTurn: string,
): Promise<DaraCallResult> {
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userTurn }],
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `Network error reaching Anthropic: ${msg(e)}`,
    };
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response, (b) => {
      const anthropic = b as AnthropicResponse;
      return anthropic.error?.message;
    });
    return {
      ok: false,
      error: `Anthropic ${response.status}${detail ? ": " + detail : ""}`,
    };
  }

  let data: AnthropicResponse;
  try {
    data = (await response.json()) as AnthropicResponse;
  } catch (e) {
    return { ok: false, error: `Response was not JSON: ${msg(e)}` };
  }

  const text = (data.content ?? [])
    .filter((b): b is AnthropicContentBlock & { text: string } =>
      Boolean(b.text),
    )
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) return { ok: false, error: "Claude returned empty output." };
  return parseActions(text);
}

// --- Google Gemini ---

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userTurn: string,
): Promise<DaraCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userTurn }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `Network error reaching Google: ${msg(e)}`,
    };
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response, (b) => {
      const gemini = b as GeminiResponse;
      return gemini.error?.message;
    });
    return {
      ok: false,
      error: `Google ${response.status}${detail ? ": " + detail : ""}`,
    };
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch (e) {
    return { ok: false, error: `Response was not JSON: ${msg(e)}` };
  }

  if (data.promptFeedback?.blockReason) {
    return {
      ok: false,
      error: `Gemini blocked the prompt: ${data.promptFeedback.blockReason}`,
    };
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();

  if (!text) return { ok: false, error: "Gemini returned empty output." };
  return parseActions(text);
}

// --- shared ---

async function readErrorDetail(
  response: Response,
  extract: (body: unknown) => string | undefined,
): Promise<string> {
  try {
    const body = await response.json();
    return extract(body) ?? "";
  } catch {
    return "";
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Dara is instructed to emit a bare JSON array of actions. Be forgiving:
 * also accept a ```json fenced block or a trailing/leading prose line. If
 * Gemini (with responseMimeType=application/json) returns a single object
 * instead of an array, wrap it.
 */
function parseActions(raw: string): DaraCallResult {
  const stripped = stripJsonFence(raw);
  const trimmed = stripped.trim();

  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      return { ok: true, actions: [obj as DaraAction] };
    } catch {
      // fall through to array extraction
    }
  }

  const arrayText = extractFirstArray(stripped);
  if (!arrayText) {
    return {
      ok: false,
      error: `Model did not return a JSON array. Raw response:\n${raw.slice(
        0,
        400,
      )}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(arrayText);
  } catch (e) {
    return {
      ok: false,
      error: `Could not parse actions as JSON: ${msg(e)}`,
    };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Model returned JSON that is not an array." };
  }

  return { ok: true, actions: parsed as DaraAction[] };
}

function stripJsonFence(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fence ? fence[1].trim() : text.trim();
}

function extractFirstArray(text: string): string | undefined {
  const start = text.indexOf("[");
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}
