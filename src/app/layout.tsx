import type { Metadata } from "next";
import "./globals.css";
import { validateCriticalServerEnv } from "@/lib/server/env-validation";

validateCriticalServerEnv();

export const metadata: Metadata = {
  title: "LinkBio Studio",
  description: "Create and publish custom link pages with branded social previews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
