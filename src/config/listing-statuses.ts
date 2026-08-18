export type StatusTone = "success" | "warning" | "danger" | "brand" | "neutral";

export interface ListingStatusDefinition {
  code: string;
  label: string;
  description: string;
  tone: StatusTone;
  aliases: string[];
  /** Listing is publicly visible / fully functional in this status. */
  isLive?: boolean;
  /** Severity-driving terminal or enforced statuses. */
  isProblem?: boolean;
}

/**
 * Official OpenSooq listing STATUS codes.
 * Text aliases resolve Log History action labels and informal CDC exports.
 */
export const LISTING_STATUS_DEFINITIONS: ListingStatusDefinition[] = [
  {
    code: "100",
    label: "New",
    description: "Just created, not yet reviewed or processed.",
    tone: "neutral",
    aliases: ["new", "enew", "just created", "created", "draft"],
  },
  {
    code: "101",
    label: "Pending",
    description: "Awaiting approval or moderation before going live.",
    tone: "warning",
    aliases: [
      "pending",
      "pending_review",
      "pending review",
      "under_review",
      "under review",
      "pending approval",
      "awaiting review",
      "awaiting approval",
      "waiting review",
      "needs review",
      "pending_payment",
      "pending payment",
      "payment_pending",
      "awaiting_payment",
      "awaiting payment",
      "under_moderation",
      "under moderation",
      "moderation",
    ],
  },
  {
    code: "102",
    label: "Deactivated",
    description: "Manually turned off by owner or admin (reversible).",
    tone: "neutral",
    aliases: [
      "deactivated",
      "deactivate",
      "inactive",
      "unpublished",
      "disabled",
      "turned off",
      "not active",
      "paused",
      "on_hold",
      "on hold",
    ],
  },
  {
    code: "103",
    label: "Blocked",
    description: "Suspended for policy or violation reasons (admin-enforced).",
    tone: "danger",
    isProblem: true,
    aliases: [
      "blocked",
      "suspended",
      "banned",
      "rejected",
      "reject",
      "declined",
      "refused",
      "not approved",
      "disapproved",
    ],
  },
  {
    code: "104",
    label: "Hidden",
    description: "Not publicly visible, but not deactivated or blocked.",
    tone: "neutral",
    aliases: ["hidden", "hide"],
  },
  {
    code: "200",
    label: "Expired",
    description: "Past its valid lifetime, no longer active.",
    tone: "warning",
    isProblem: true,
    aliases: ["expired", "expire", "expiry"],
  },
  {
    code: "300",
    label: "Active",
    description: "Live and fully visible / functional.",
    tone: "success",
    isLive: true,
    aliases: [
      "active",
      "live",
      "activated",
      "published",
      "approved",
      "approve",
      "reactivated",
      "post live",
      "is live",
      "first live",
    ],
  },
  {
    code: "301",
    label: "Premium",
    description: "Active with paid / premium features enabled.",
    tone: "brand",
    isLive: true,
    aliases: ["premium", "featured premium", "paid"],
  },
];

/** Codes that mean the listing is publicly live. */
export const LIVE_STATUS_CODES = new Set(
  LISTING_STATUS_DEFINITIONS.filter((d) => d.isLive).map((d) => d.code),
);

/** Codes that usually warrant QA attention. */
export const PROBLEM_STATUS_CODES = new Set(
  LISTING_STATUS_DEFINITIONS.filter((d) => d.isProblem).map((d) => d.code),
);

const BY_VALUE = new Map<string, ListingStatusDefinition>();

/** "Pending  Payment", "pending_payment" and "PENDING-PAYMENT" must all resolve alike. */
function normalizeStatusKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .trim();
}

for (const definition of LISTING_STATUS_DEFINITIONS) {
  BY_VALUE.set(definition.code, definition);
  BY_VALUE.set(normalizeStatusKey(definition.label), definition);
  for (const alias of definition.aliases) {
    BY_VALUE.set(normalizeStatusKey(alias), definition);
  }
}

export function getListingStatusDefinition(
  value: unknown,
): ListingStatusDefinition | undefined {
  const key = normalizeStatusKey(value);
  return key ? BY_VALUE.get(key) : undefined;
}

export function isKnownStatus(value: unknown): boolean {
  return getListingStatusDefinition(value) !== undefined;
}

export function isLiveStatus(value: unknown): boolean {
  const key = String(value ?? "").trim();
  if (LIVE_STATUS_CODES.has(key)) return true;
  return getListingStatusDefinition(value)?.isLive === true;
}

export function isProblemStatus(value: unknown): boolean {
  const key = String(value ?? "").trim();
  if (PROBLEM_STATUS_CODES.has(key)) return true;
  return getListingStatusDefinition(value)?.isProblem === true;
}

export function listingStatusLabel(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "Unknown";
  const known = getListingStatusDefinition(raw);
  if (known) return known.label;

  if (/^\d+$/.test(raw)) return `Status ${raw}`;

  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function listingStatusTone(value: unknown): StatusTone {
  return getListingStatusDefinition(value)?.tone ?? "neutral";
}
