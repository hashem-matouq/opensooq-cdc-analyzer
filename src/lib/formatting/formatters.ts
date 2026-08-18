import { getFieldDefinition } from "@/config/field-definitions";
import { listingStatusLabel } from "@/config/listing-statuses";
import { parseMaybeJson, safeString, toBooleanish } from "@/lib/utils";

const COUNTRY_NAMES: Record<string, string> = {
  JO: "Jordan",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  EG: "Egypt",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
  IQ: "Iraq",
  LB: "Lebanon",
  PS: "Palestine",
  SY: "Syria",
  QA: "Qatar",
  LY: "Libya",
  SD: "Sudan",
  YE: "Yemen",
  MA: "Morocco",
  TN: "Tunisia",
  DZ: "Algeria",
  US: "United States",
  GB: "United Kingdom",
};

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  fr: "French",
  ku: "Kurdish",
};

const OPERATION_LABELS: Record<string, string> = {
  insert: "Created",
  i: "Created",
  create: "Created",
  created: "Created",
  update: "Updated",
  u: "Updated",
  updated: "Updated",
  delete: "Deleted",
  d: "Deleted",
  deleted: "Deleted",
};

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(6, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function maskIp(value: string): string {
  const parts = value.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  if (value.includes(":")) {
    const chunks = value.split(":");
    return `${chunks.slice(0, 2).join(":")}:xxxx:xxxx`;
  }
  return "xxx.xxx.xxx.xxx";
}

export function maskMemberId(value: string): string {
  if (value.length <= 3) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function formatCountry(value: unknown): string {
  const code = safeString(value).toUpperCase();
  if (!code) return "—";
  return COUNTRY_NAMES[code] ?? code;
}

export function formatLanguage(value: unknown): string {
  const code = safeString(value).toLowerCase();
  if (!code) return "—";
  return LANGUAGE_NAMES[code] ?? code;
}

export function formatOperation(value: unknown): string {
  const key = safeString(value).toLowerCase();
  return OPERATION_LABELS[key] ?? (key ? key : "Unknown");
}

export function formatStatus(value: unknown): string {
  const key = safeString(value);
  if (!key) return "—";
  return listingStatusLabel(key);
}

export function formatYesNo(value: unknown): string {
  const bool = toBooleanish(value);
  if (bool === undefined) return safeString(value) || "—";
  return bool ? "Yes" : "No";
}

export function formatViolation(value: unknown): string {
  const bool = toBooleanish(value);
  if (bool === undefined) return safeString(value) || "—";
  return bool ? "Detected" : "No";
}

export function formatDateTime(value: unknown): string {
  const raw = safeString(value);
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatPrice(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return safeString(value) || "—";
  return amount.toLocaleString();
}

export function formatJsonAction(value: unknown): Record<string, string> | string {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return safeString(value) || "—";
  }

  const obj = parsed as Record<string, unknown>;
  const result: Record<string, string> = {};

  if (obj.action !== undefined) {
    result.Action = humanizeAction(safeString(obj.action));
  }
  if (obj.actor_type !== undefined) {
    result.Actor = humanizeActor(safeString(obj.actor_type));
  }
  if (obj.actor !== undefined) {
    result["Actor ID"] = safeString(obj.actor);
  }
  if (obj.is_overlimit !== undefined) {
    result["Over-limit"] = formatYesNo(obj.is_overlimit);
  }
  if (obj.live_count !== undefined) {
    result["Live listing count"] = safeString(obj.live_count);
  }
  if (obj.rule_id !== undefined) {
    result.Rule = safeString(obj.rule_id);
  }
  if (obj.source !== undefined) {
    result.Source = safeString(obj.source);
  }

  for (const [key, val] of Object.entries(obj)) {
    if (
      ["action", "actor", "actor_type", "is_overlimit", "live_count", "rule_id", "source"].includes(
        key,
      )
    ) {
      continue;
    }
    result[key.replace(/_/g, " ")] = safeString(val);
  }

  return result;
}

export function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    activate: "Listing activated",
    deactivate: "Listing deactivated",
    update: "Listing updated",
    create: "Listing created",
    delete: "Listing deleted",
    expire: "Listing expired",
    repost: "Listing reposted",
    moderate: "Moderation action",
    feature: "Listing featured",
    unfeature: "Listing unfeatured",
  };
  return map[action.toLowerCase()] ?? action.replace(/_/g, " ");
}

export function humanizeActor(actorType: string): string {
  const map: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    system: "System",
    rule_engine: "Rule engine",
    moderator: "Moderator",
  };
  return map[actorType.toLowerCase()] ?? actorType;
}

export function formatFieldValue(
  fieldName: string,
  value: unknown,
  options?: { showSensitive?: boolean; currency?: unknown },
): string {
  if (value === null || value === undefined || value === "") return "—";

  const def = getFieldDefinition(fieldName);
  const raw = safeString(value);

  if (def.sensitive && !options?.showSensitive) {
    if (def.formatter === "phone" || /phone/i.test(fieldName)) return maskPhone(raw);
    if (def.formatter === "email" || /email/i.test(fieldName)) return maskEmail(raw);
    if (/ip/i.test(fieldName)) return maskIp(raw);
    if (/members?_?id/i.test(fieldName)) return maskMemberId(raw);
  }

  switch (def.formatter) {
    case "yesNo":
      return formatYesNo(value);
    case "violation":
      return formatViolation(value);
    case "operation":
      return formatOperation(value);
    case "status":
      return formatStatus(value);
    case "country":
      return formatCountry(value);
    case "language":
      return formatLanguage(value);
    case "datetime":
      return formatDateTime(value);
    case "price":
      return formatPrice(value);
    case "email":
      return options?.showSensitive ? raw : maskEmail(raw);
    case "phone":
      return options?.showSensitive ? raw : maskPhone(raw);
    case "jsonAction": {
      const formatted = formatJsonAction(value);
      if (typeof formatted === "string") return formatted;
      return Object.entries(formatted)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
    }
    default:
      return raw;
  }
}

export function explainField(
  fieldName: string,
  value: unknown,
  options?: { showSensitive?: boolean },
) {
  const def = getFieldDefinition(fieldName);
  return {
    fieldName: def.fieldName,
    displayName: def.displayName,
    description: def.description,
    category: def.category,
    rawValue: safeString(value),
    meaning: formatFieldValue(fieldName, value, options),
    known: def.dataType !== "unknown",
  };
}
