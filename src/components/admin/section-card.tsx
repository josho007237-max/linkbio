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
    <CardHeader className="rounded-t-xl border-b border-border/60 bg-muted/25 pb-3">
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 pt-4">{children}</CardContent>
  </Card>
);
