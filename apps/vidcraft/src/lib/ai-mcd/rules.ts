/**
 * AI MCD prompt rule guards. These are the automatic checks run on every
 * Scene Image / character / location prompt before it's considered valid.
 * They enforce three pillars of the methodology:
 *   1. Negative/blocking list is mandatory on every prompt.
 *   2. No real brand names (Flow's generator refuses them).
 *   3. Copy-verbatim rule (enforced in the store, not here).
 */

/**
 * Real brand names Flow refuses to render. Not exhaustive — the user can
 * extend this list. Pulled from the ai-mcd-production skill's examples.
 */
export const BRAND_BLOCKLIST = [
  "Nike",
  "Adidas",
  "Puma",
  "Apple",
  "AirPods",
  "CarPlay",
  "iPhone",
  "iPad",
  "MacBook",
  "Samsung",
  "Google Pixel",
  "Vogue",
  "GQ",
  "Range Rover",
  "Autobiography",
  "Mercedes",
  "BMW",
  "Audi",
  "Rolex",
  "Patek",
  "Gucci",
  "Louis Vuitton",
  "Prada",
  "Chanel",
  "Starbucks",
  "Coca-Cola",
  "Pepsi",
  "McDonald",
] as const;

export type BrandMatch = {
  brand: string;
  index: number;
};

/**
 * Scan a prompt for brand names Flow is known to refuse. Case-insensitive,
 * whole-word matching only (so "Pumas the cat" doesn't trigger on "Puma").
 */
export function findBrandNames(text: string): BrandMatch[] {
  if (!text) return [];
  const matches: BrandMatch[] = [];
  for (const brand of BRAND_BLOCKLIST) {
    const re = new RegExp(`\\b${escapeRegex(brand)}\\b`, "i");
    const m = re.exec(text);
    if (m) matches.push({ brand, index: m.index });
  }
  return matches;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type RuleIssue = {
  severity: "error" | "warning";
  message: string;
};

/**
 * Validate a Character/Location Bible entry before saving. Returns the list
 * of issues; empty = fine to save. Caller decides whether to block save on
 * errors or just show warnings.
 */
export function validateBibleEntry(input: {
  tagName: string;
  verbatimSummary: string;
  negativeList: string;
}): RuleIssue[] {
  const issues: RuleIssue[] = [];

  if (!input.tagName.trim()) {
    issues.push({ severity: "error", message: "Tag name is required." });
  }
  if (!input.verbatimSummary.trim()) {
    issues.push({
      severity: "error",
      message: "Verbatim summary is required.",
    });
  }
  if (!input.negativeList.trim()) {
    issues.push({
      severity: "error",
      message:
        "Negative/blocking list is required — every prompt must state what must NOT appear.",
    });
  }

  const brandsInSummary = findBrandNames(input.verbatimSummary);
  if (brandsInSummary.length > 0) {
    issues.push({
      severity: "warning",
      message: `Verbatim summary references a real brand name: ${brandsInSummary
        .map((b) => b.brand)
        .join(", ")}. Flow may refuse. Use a generic premium descriptor.`,
    });
  }

  return issues;
}
