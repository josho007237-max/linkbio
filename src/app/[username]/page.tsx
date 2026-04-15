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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8eefc,_transparent_42%),linear-gradient(to_bottom,_var(--background),_var(--muted))] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
          <div className="h-24 animate-pulse rounded-2xl border bg-card/80" />
          <div className="mx-auto h-[760px] w-full max-w-[390px] animate-pulse rounded-[40px] border-8 border-zinc-900 bg-zinc-900/60" />
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
