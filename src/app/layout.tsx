import type { Metadata } from "next";
import "./globals.css";
import { validateCriticalServerEnv } from "@/lib/server/env-validation";

validateCriticalServerEnv();

export const metadata: Metadata = {
  title: "Link Bio Builder",
  description: "Mobile-first link-in-bio admin and public profile experience.",
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
