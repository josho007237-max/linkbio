import { validateCriticalServerEnv } from "@/lib/server/env-validation";

export const ADMIN_SESSION_COOKIE_NAME = "linkbio_admin_session";
const ADMIN_SESSION_COOKIE_VALUE = "authenticated";

export const getAdminPassword = (): string => validateCriticalServerEnv().adminPassword;

export const isAdminPasswordValid = (inputPassword: string): boolean => {
  const expected = getAdminPassword();
  if (!expected) {
    return false;
  }
  return inputPassword === expected;
};

export const isAdminSessionCookieValid = (cookieValue: string | undefined): boolean =>
  cookieValue === ADMIN_SESSION_COOKIE_VALUE;

export const createAdminSessionCookie = () => ({
  name: ADMIN_SESSION_COOKIE_NAME,
  value: ADMIN_SESSION_COOKIE_VALUE,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8,
});
