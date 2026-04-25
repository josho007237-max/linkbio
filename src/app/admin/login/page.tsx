"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/use-i18n";

const resolveNextPath = (candidate: string | null): string => {
  if (!candidate || !candidate.startsWith("/admin")) {
    return "/admin";
  }
  return candidate;
};

export default function AdminLoginPage() {
  const { t } = useI18n();
  const [nextPath, setNextPath] = useState("/admin");

  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(resolveNextPath(params.get("next")));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setErrorMessage(t("admin_login_error_invalid"));
        return;
      }

      window.location.href = nextPath;
    } catch {
      setErrorMessage(t("admin_login_error_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] p-4">
      <section className="w-full max-w-sm rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
        <h1 className="text-xl font-semibold">{t("admin_login_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin_login_subtitle")}</p>
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="admin-password">{t("admin_login_password")}</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {errorMessage ? (
            <p className="text-xs text-destructive">{errorMessage}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t("admin_login_submitting") : t("admin_login_submit")}
          </Button>
        </form>
      </section>
    </main>
  );
}
