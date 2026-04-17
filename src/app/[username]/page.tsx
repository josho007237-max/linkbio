"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const PublicProfilePageClient = dynamic(
  () =>
    import("@/components/public/public-profile-page-client").then(
      (module) => module.PublicProfilePageClient,
    ),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8eefc,_transparent_42%),linear-gradient(to_bottom,_var(--background),_var(--muted))]">
        <div className="mx-auto w-full max-w-[680px] space-y-4 px-4 py-6 sm:px-5 sm:py-8 md:px-6">
          <div className="ml-auto h-9 w-36 animate-pulse rounded-md border bg-card/80" />
          <div className="h-[420px] w-full animate-pulse rounded-[28px] border bg-card/45 sm:h-[520px]" />
        </div>
      </main>
    ),
  },
);

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username ?? "";

  return <PublicProfilePageClient key={username} username={username} />;
}
