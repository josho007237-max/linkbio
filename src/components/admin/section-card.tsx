import { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionCardProps = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
};

export const SectionCard = ({ id, title, description, children }: SectionCardProps) => (
  <Card
    id={id}
    className="scroll-mt-24 border border-border/70 bg-background/95 shadow-sm"
  >
    <CardHeader className="rounded-t-xl border-b border-border/60 bg-gradient-to-r from-muted/35 to-muted/10 pb-3">
      <CardTitle className="text-[15px] tracking-[0.01em]">{title}</CardTitle>
      <CardDescription className="text-xs leading-5">{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 p-4 sm:p-5">{children}</CardContent>
  </Card>
);
