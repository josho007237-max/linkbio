"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/section-card";
import { TextFormValues, textSchema } from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/use-i18n";

export const TextSection = () => {
  const { t } = useI18n();
  const text = useBuilderStore((state) => state.text);
  const theme = useBuilderStore((state) => state.theme);
  const updateText = useBuilderStore((state) => state.updateText);
  const updateTheme = useBuilderStore((state) => state.updateTheme);

  const form = useForm<TextFormValues>({
    resolver: zodResolver(textSchema),
    mode: "onChange",
    defaultValues: {
      intro: text.intro,
      body: text.body,
      footerEnabled: text.footerEnabled ?? false,
      footerText: text.footerText ?? "",
    },
  });
  const values = useWatch({ control: form.control });
  const footerEnabled = useWatch({ control: form.control, name: "footerEnabled" });

  useEffect(() => {
    const parsed = textSchema.safeParse(values);
    if (parsed.success) {
      updateText(parsed.data);
    }
  }, [updateText, values]);

  return (
    <SectionCard
      id="text"
      title={t("text_title")}
      description={t("text_desc")}
    >
      <div className="space-y-2">
        <Label htmlFor="intro">{t("text_intro")}</Label>
        <Input id="intro" {...form.register("intro")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">{t("text_body")}</Label>
        <Textarea id="body" rows={4} {...form.register("body")} />
      </div>
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <p className="text-sm font-medium">{t("text_design_controls")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("text_page_font")}</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={theme.pageFont ?? "inter"}
              onChange={(event) =>
                updateTheme({
                  pageFont: event.target.value as
                    | "inter"
                    | "poppins"
                    | "manrope"
                    | "space_grotesk",
                })
              }
            >
              <option value="inter">Inter</option>
              <option value="poppins">Poppins</option>
              <option value="manrope">Manrope</option>
              <option value="space_grotesk">Space Grotesk</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("text_page_text_color")}</Label>
            <Input
              value={theme.textColor}
              onChange={(event) => updateTheme({ textColor: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("text_title_color")}</Label>
            <Input
              value={theme.titleColor ?? theme.textColor}
              onChange={(event) => updateTheme({ titleColor: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("text_title_size")}</Label>
            <Input
              type="number"
              value={theme.titleSize ?? 28}
              onChange={(event) =>
                updateTheme({
                  titleSize: Number(event.target.value) || 28,
                })
              }
            />
          </div>
        </div>
      </div>
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <p className="text-sm font-medium">{t("footer_title")}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(footerEnabled)}
            onChange={(event) =>
              form.setValue("footerEnabled", event.target.checked, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          {t("footer_enabled")}
        </label>
        <div className="space-y-2">
          <Label htmlFor="footerText">{t("footer_text")}</Label>
          <Input id="footerText" {...form.register("footerText")} />
        </div>
      </div>
    </SectionCard>
  );
};
