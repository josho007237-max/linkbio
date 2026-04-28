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
    className="scroll-mt-24 overflow-hidden border border-border/70 bg-background/95 shadow-sm"
  >
    <CardHeader className="border-b border-border/60 bg-gradient-to-r from-muted/35 to-muted/10 pb-3 pt-4">
      <CardTitle className="text-sm font-semibold tracking-[0.01em] sm:text-[15px]">{title}</CardTitle>
      <CardDescription className="text-[11px] leading-5 text-muted-foreground/90 sm:text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 p-3.5 sm:p-4">{children}</CardContent>
  </Card>
);
