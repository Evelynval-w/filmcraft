/**
 * Parse a free-form AI MCD paste into Characters, Locations and Scenes.
 *
 * The paste uses labeled sections. Example:
 *
 *   # CHARACTER: DARA
 *   A 32-year-old Nigerian woman with... (verbatim identity + wardrobe + props)
 *   NEGATIVE: no sunglasses, no tattoos
 *
 *   # LOCATION: KITCHEN_WARM_MORNING
 *   A modest Lagos kitchen at 7am...
 *   NEGATIVE: no modern appliances
 *
 *   # SCENE: Dara at the window
 *   BEAT: She realizes the money is missing.
 *   CHARACTERS: DARA
 *   LOCATION: KITCHEN_WARM_MORNING
 *   SHOT: medium shot, soft morning light, Dara stands by the window...
 *   NEGATIVE: no phone
 *
 * Section headers (# CHARACTER / # LOCATION / # SCENE) delimit entries. Field
 * labels (NEGATIVE, BEAT, CHARACTERS, LOCATION, SHOT) are case-insensitive and
 * must appear at the start of a line.
 */

export type ParsedCharacter = {
  tagName: string;
  verbatimSummary: string;
  negativeList: string;
};

export type ParsedLocation = {
  tagName: string;
  verbatimSummary: string;
  negativeList: string;
};

export type ParsedScene = {
  title?: string;
  beat?: string;
  characterTags: string[];
  locationTag?: string;
  shotDescription: string;
  negativeAdditions: string;
};

export type MCDImportResult = {
  characters: ParsedCharacter[];
  locations: ParsedLocation[];
  scenes: ParsedScene[];
  errors: string[];
};

type RawBlock = {
  kind: "character" | "location" | "scene";
  header: string;
  body: string;
  lineNumber: number;
};

const HEADER_RE = /^#\s+(CHARACTER|LOCATION|SCENE)\s*:\s*(.+?)\s*$/i;

export function parseMCDPaste(input: string): MCDImportResult {
  const result: MCDImportResult = {
    characters: [],
    locations: [],
    scenes: [],
    errors: [],
  };

  const blocks = splitIntoBlocks(input);

  for (const block of blocks) {
    try {
      if (block.kind === "character") {
        result.characters.push(parseCharacterBlock(block));
      } else if (block.kind === "location") {
        result.locations.push(parseLocationBlock(block));
      } else {
        result.scenes.push(parseSceneBlock(block));
      }
    } catch (e) {
      result.errors.push(
        `Line ${block.lineNumber} (${block.kind} "${block.header}"): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  return result;
}

function splitIntoBlocks(input: string): RawBlock[] {
  const lines = input.split(/\r?\n/);
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  lines.forEach((line, i) => {
    const match = line.match(HEADER_RE);
    if (match) {
      if (current) blocks.push(current);
      const kind = match[1].toLowerCase() as "character" | "location" | "scene";
      current = {
        kind,
        header: match[2].trim(),
        body: "",
        lineNumber: i + 1,
      };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  });
  if (current) blocks.push(current);
  return blocks;
}

function extractField(body: string, label: string): string | undefined {
  const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im");
  const m = body.match(re);
  return m ? m[1].trim() : undefined;
}

function stripFields(body: string, labels: string[]): string {
  const re = new RegExp(
    `^\\s*(${labels.join("|")})\\s*:.*$`,
    "gim",
  );
  return body.replace(re, "").trim();
}

function parseCharacterBlock(block: RawBlock): ParsedCharacter {
  if (!block.header) throw new Error("missing character tag name");
  const negative = extractField(block.body, "NEGATIVE") ?? "";
  const summary = stripFields(block.body, ["NEGATIVE"]).trim();
  if (!summary) throw new Error("character has no verbatim summary body");
  if (!negative)
    throw new Error("character has no NEGATIVE line (required by AI MCD)");
  return {
    tagName: block.header.toUpperCase(),
    verbatimSummary: summary,
    negativeList: negative,
  };
}

function parseLocationBlock(block: RawBlock): ParsedLocation {
  if (!block.header) throw new Error("missing location tag name");
  const negative = extractField(block.body, "NEGATIVE") ?? "";
  const summary = stripFields(block.body, ["NEGATIVE"]).trim();
  if (!summary) throw new Error("location has no verbatim summary body");
  if (!negative)
    throw new Error("location has no NEGATIVE line (required by AI MCD)");
  return {
    tagName: block.header.toUpperCase(),
    verbatimSummary: summary,
    negativeList: negative,
  };
}

function parseSceneBlock(block: RawBlock): ParsedScene {
  const beat = extractField(block.body, "BEAT");
  const chars = extractField(block.body, "CHARACTERS");
  const loc = extractField(block.body, "LOCATION");
  const shot = extractField(block.body, "SHOT");
  const negative = extractField(block.body, "NEGATIVE");

  const characterTags = chars
    ? chars
        .split(/[,|]/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : [];

  const shotDescription =
    shot ?? stripFields(block.body, ["BEAT", "CHARACTERS", "LOCATION", "SHOT", "NEGATIVE"]).trim();

  if (!shotDescription) throw new Error("scene has no SHOT body");

  return {
    title: block.header || undefined,
    beat,
    characterTags,
    locationTag: loc ? loc.trim().toUpperCase() : undefined,
    shotDescription,
    negativeAdditions: negative ?? "",
  };
}

export const MCD_EXAMPLE = `# CHARACTER: DARA
A 32-year-old Nigerian woman, warm brown skin, oval face, soft almond-shaped eyes, natural dark hair pulled into a low bun with a few stray strands. She wears a faded indigo wrapper tied at the chest, no jewelry. Her hands are small but calloused. Expression: tired, watchful.
NEGATIVE: no sunglasses, no tattoos, no modern makeup, no logos, no hats

# LOCATION: KITCHEN_WARM_MORNING
A modest Lagos kitchen at 7am. Yellow sunlight slanting through a slatted wooden window. Chipped tile floor, blue painted walls peeling at the corners, a kerosene stove with a black kettle. A single wooden stool. Warm golden-hour tonality.
NEGATIVE: no modern appliances, no logos, no stainless steel, no overhead electric light

# SCENE: Dara at the window
BEAT: She realizes the money envelope is missing.
CHARACTERS: DARA
LOCATION: KITCHEN_WARM_MORNING
SHOT: Medium wide shot, static camera at eye level. Dara stands beside the window, right hand holding the empty envelope at her side, left hand pressed flat on the counter. Her head is turned slightly down, eyes narrowed on the envelope. Soft morning light rakes across her face from the right.
NEGATIVE: no phone, no visible writing on the envelope
`;
