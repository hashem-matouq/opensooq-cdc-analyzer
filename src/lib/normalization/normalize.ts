import type { CDCOperation, CDCRecord } from "@/types/cdc";
import { normalizeKey, parseMaybeJson, safeString, toBooleanish, toNumberish } from "@/lib/utils";

function pick(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const upper = key.toUpperCase();
    if (raw[upper] !== undefined && raw[upper] !== null && raw[upper] !== "") {
      return raw[upper];
    }
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") {
      return raw[key];
    }
  }
  return undefined;
}

export function normalizeOperation(value: unknown): CDCOperation {
  const key = safeString(value).toLowerCase();
  if (["insert", "i", "create", "created"].includes(key)) return "insert";
  if (["update", "u", "updated"].includes(key)) return "update";
  if (["delete", "d", "deleted"].includes(key)) return "delete";
  return "unknown";
}

export function normalizeRawRow(row: Record<string, unknown>, index: number): CDCRecord {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key || key.trim() === "") continue;
    raw[normalizeKey(key)] = typeof value === "string" ? value.trim() : value;
  }

  const lastEdit = parseMaybeJson(pick(raw, ["LAST_EDIT_ACTION"]));
  const id = safeString(pick(raw, ["ID", "LISTING_ID", "POST_ID"])) || undefined;
  const timestamp =
    safeString(
      pick(raw, ["SF_TIMESTAMP", "TIMESTAMP", "RECORD_UPDATE_DATE", "DATE", "RECORD_INSERT_DATE"]),
    ) || undefined;

  return {
    uid: `${id ?? "row"}-${index}-${safeString(pick(raw, ["REQUEST_ID", "SF_OP"])) || index}`,
    id,
    operation: normalizeOperation(pick(raw, ["SF_OP", "OPERATION", "OP", "CDC_OP"])),
    timestamp,
    entity: {
      title: safeString(pick(raw, ["TITLE", "DISPLAY_NAME"])) || undefined,
      description: safeString(pick(raw, ["DESCRIPTION"])) || undefined,
      price: toNumberish(pick(raw, ["PRICE", "BASE_PRICE"])),
      currency: safeString(pick(raw, ["PRICE_CURRENCY", "CURRENCY"])) || undefined,
      category: safeString(pick(raw, ["CATEGORY", "CATEGORIES_NAME"])) || undefined,
      categoryId: safeString(pick(raw, ["CATEGORIES_ID", "NEW_CAT_ID"])) || undefined,
      cityId: safeString(pick(raw, ["CITIES_ID"])) || undefined,
      country:
        safeString(pick(raw, ["POST_INSERT_IP_COUNTRY", "POST_UPDATE_IP_COUNTRY", "COUNTRY"])) ||
        undefined,
      countryId: safeString(pick(raw, ["COUNTRIES_ID"])) || undefined,
      language: safeString(pick(raw, ["LANG", "LANGUAGE"])) || undefined,
      phone: safeString(pick(raw, ["PHONE"])) || undefined,
      email: safeString(pick(raw, ["EMAIL"])) || undefined,
    },
    status: {
      active: toBooleanish(pick(raw, ["ACTIVE", "IS_ACTIVE"])),
      status: (pick(raw, ["STATUS"]) as string | number | undefined) ?? undefined,
      featured: toBooleanish(pick(raw, ["IS_FEATURED", "FEATURED"])),
      highlighted: toBooleanish(pick(raw, ["IS_HIGHLIGHTED", "HIGHLIGHTED"])),
      violation: toBooleanish(pick(raw, ["VIOLATION", "HAS_VIOLATION"])),
      firstLive: toBooleanish(pick(raw, ["IS_FIRST_LIVE"])),
      hasPrice: toBooleanish(pick(raw, ["HAS_PRICE"])),
    },
    user: {
      memberId: safeString(pick(raw, ["MEMBERS_ID", "MEMBER_ID", "USER_ID"])) || undefined,
    },
    cdc: {
      requestId: safeString(pick(raw, ["REQUEST_ID"])) || undefined,
      lastEditAction: lastEdit,
      recordInsertDate: safeString(pick(raw, ["RECORD_INSERT_DATE"])) || undefined,
      recordUpdateDate: safeString(pick(raw, ["RECORD_UPDATE_DATE"])) || undefined,
      recordExpirationDate: safeString(pick(raw, ["RECORD_EXPIRATION_DATE"])) || undefined,
      postInsertIpCountry: safeString(pick(raw, ["POST_INSERT_IP_COUNTRY"])) || undefined,
      postUpdateIpCountry: safeString(pick(raw, ["POST_UPDATE_IP_COUNTRY"])) || undefined,
      numberOfTimesReposted: toNumberish(pick(raw, ["NUMBER_OF_TIMES_REPOSTED"])),
      postSource: safeString(pick(raw, ["POST_SOURCE"])) || undefined,
      postType: safeString(pick(raw, ["POST_TYPE"])) || undefined,
    },
    raw,
  };
}

export function detectFields(records: CDCRecord[]): string[] {
  const fields = new Set<string>();
  for (const record of records) {
    Object.keys(record.raw).forEach((key) => fields.add(key));
  }
  return Array.from(fields).sort();
}

export function recordsFromRows(rows: Record<string, unknown>[]): CDCRecord[] {
  return rows
    .filter((row) => Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
    .map((row, index) => normalizeRawRow(row, index));
}
