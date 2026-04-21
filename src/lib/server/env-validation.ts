import "server-only";

const PLACEHOLDER_PATTERNS = [
  "ใส่ค่าเดิมของคุณ",
  "your_value_here",
  "changeme",
] as const;

type ValidatedEnv = {
  nextPublicSupabaseUrl: string;
  nextPublicSupabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  adminPassword: string;
};

let cachedValidatedEnv: ValidatedEnv | null = null;

const isPlaceholderValue = (value: string): boolean => {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()));
};

const addEmptyOrPlaceholderError = (
  errors: string[],
  key: string,
  value: string,
  label: string,
) => {
  if (!value) {
    errors.push(`${key} is missing or empty (${label}).`);
    return;
  }
  if (isPlaceholderValue(value)) {
    errors.push(`${key} contains placeholder text and must be replaced with a real value.`);
  }
};

const assertHttpsUrl = (errors: string[], key: string, value: string) => {
  if (!value || isPlaceholderValue(value)) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${key} must be a valid https URL.`);
    return;
  }
  if (parsed.protocol !== "https:") {
    errors.push(`${key} must use https.`);
  }
};

const throwValidationError = (errors: string[]) => {
  if (errors.length === 0) {
    return;
  }
  const message = [
    "[env] Invalid environment configuration.",
    ...errors.map((line) => `- ${line}`),
  ].join("\n");
  throw new Error(message);
};

export const validateCriticalServerEnv = (): ValidatedEnv => {
  if (cachedValidatedEnv) {
    return cachedValidatedEnv;
  }

  const nextPublicSupabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const nextPublicSupabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const adminPassword = (process.env.ADMIN_PASSWORD ?? "").trim();

  const errors: string[] = [];

  addEmptyOrPlaceholderError(
    errors,
    "NEXT_PUBLIC_SUPABASE_URL",
    nextPublicSupabaseUrl,
    "Supabase project URL",
  );
  assertHttpsUrl(errors, "NEXT_PUBLIC_SUPABASE_URL", nextPublicSupabaseUrl);

  addEmptyOrPlaceholderError(
    errors,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    nextPublicSupabaseAnonKey,
    "Supabase anon key",
  );
  addEmptyOrPlaceholderError(
    errors,
    "SUPABASE_SERVICE_ROLE_KEY",
    supabaseServiceRoleKey,
    "Supabase service role key",
  );
  addEmptyOrPlaceholderError(errors, "ADMIN_PASSWORD", adminPassword, "admin password");

  throwValidationError(errors);

  cachedValidatedEnv = {
    nextPublicSupabaseUrl,
    nextPublicSupabaseAnonKey,
    supabaseServiceRoleKey,
    adminPassword,
  };
  return cachedValidatedEnv;
};

