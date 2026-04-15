"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/section-card";
import { ButtonFormValues, buttonSchema } from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/use-i18n";

export const ButtonsSection = () => {
  const { t } = useI18n();
  const theme = useBuilderStore((state) => state.theme);
  const buttonStyle = useBuilderStore((state) => state.buttonStyle);
  const updateTheme = useBuilderStore((state) => state.updateTheme);
  const updateButtonStyle = useBuilderStore((state) => state.updateButtonStyle);

  const form = useForm<ButtonFormValues>({
    resolver: zodResolver(buttonSchema),
    mode: "onChange",
    defaultValues: {
      buttonBackground: theme.buttonBackground,
      buttonTextColor: theme.buttonTextColor,
      buttonRadius: theme.buttonRadius,
      uppercase: buttonStyle.uppercase,
      shadow: buttonStyle.shadow,
    },
  });
  const values = useWatch({ control: form.control });

  useEffect(() => {
    const parsed = buttonSchema.safeParse(values);
    if (!parsed.success) {
      return;
    }

    updateTheme({
      buttonBackground: parsed.data.buttonBackground,
      buttonTextColor: parsed.data.buttonTextColor,
      buttonRadius: parsed.data.buttonRadius,
    });
    updateButtonStyle({
      uppercase: parsed.data.uppercase,
      shadow: parsed.data.shadow,
    });
  }, [updateButtonStyle, updateTheme, values]);

  const uppercase = useWatch({ control: form.control, name: "uppercase" });
  const shadow = useWatch({ control: form.control, name: "shadow" });

  return (
    <SectionCard
      id="buttons"
      title={t("buttons_title")}
      description={t("buttons_desc")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="buttonBackground">{t("buttons_bg")}</Label>
          <Input id="buttonBackground" {...form.register("buttonBackground")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="buttonTextColor">{t("buttons_text_color")}</Label>
          <Input id="buttonTextColor" {...form.register("buttonTextColor")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="buttonRadius">{t("buttons_radius")}</Label>
        <Input id="buttonRadius" type="number" {...form.register("buttonRadius", { valueAsNumber: true })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-sm font-medium">{t("buttons_uppercase")}</span>
          <Switch checked={uppercase} onCheckedChange={(v) => form.setValue("uppercase", v)} />
        </label>
        <label className="flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-sm font-medium">{t("buttons_shadow")}</span>
          <Switch checked={shadow} onCheckedChange={(v) => form.setValue("shadow", v)} />
        </label>
      </div>
    </SectionCard>
  );
};
