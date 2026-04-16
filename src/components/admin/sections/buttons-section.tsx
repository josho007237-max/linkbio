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
      style: buttonStyle.style ?? "solid",
      shadowLevel: buttonStyle.shadowLevel ?? 2,
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
      style: parsed.data.style,
      shadowLevel: parsed.data.shadowLevel as 0 | 1 | 2 | 3,
    });
  }, [updateButtonStyle, updateTheme, values]);

  const uppercase = useWatch({ control: form.control, name: "uppercase" });
  const shadow = useWatch({ control: form.control, name: "shadow" });
  const styleMode = useWatch({ control: form.control, name: "style" });
  const shadowLevel = useWatch({ control: form.control, name: "shadowLevel" });

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
        <div className="space-y-2">
          <Label>{t("buttons_style")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["solid", t("buttons_style_solid")],
              ["glass", t("buttons_style_glass")],
              ["outline", t("buttons_style_outline")],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-md border px-2 py-2 text-xs ${
                  styleMode === value ? "bg-muted font-medium ring-1 ring-primary/30" : ""
                }`}
                onClick={() =>
                  form.setValue("style", value as "solid" | "glass" | "outline", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="shadowLevel">{t("buttons_shadow_level")}</Label>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((level) => (
              <button
                key={level}
                type="button"
                className={`rounded-md border px-2 py-2 text-xs ${
                  shadowLevel === level ? "bg-muted font-medium ring-1 ring-primary/30" : ""
                }`}
                onClick={() =>
                  form.setValue("shadowLevel", level, { shouldDirty: true, shouldValidate: true })
                }
              >
                {level}
              </button>
            ))}
          </div>
        </div>
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
