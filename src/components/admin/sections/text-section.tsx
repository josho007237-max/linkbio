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
  const updateText = useBuilderStore((state) => state.updateText);

  const form = useForm<TextFormValues>({
    resolver: zodResolver(textSchema),
    mode: "onChange",
    defaultValues: {
      intro: text.intro,
      body: text.body,
    },
  });
  const values = useWatch({ control: form.control });

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
    </SectionCard>
  );
};
