import { ButtonsSection } from "@/components/admin/sections/buttons-section";
import { HeaderSection } from "@/components/admin/sections/header-section";
import { LinksSection } from "@/components/admin/sections/links-section";
import { SocialIconsSection } from "@/components/admin/sections/social-icons-section";
import { TextSection } from "@/components/admin/sections/text-section";
import { WallpaperSection } from "@/components/admin/sections/wallpaper-section";

type EditorPanelProps = {
  slugCollisionWarning?: string | null;
};

export const EditorPanel = ({ slugCollisionWarning }: EditorPanelProps) => (
  <section className="space-y-5 rounded-2xl border border-border/60 bg-gradient-to-b from-background/80 to-muted/15 p-3 sm:p-4">
    <HeaderSection slugCollisionWarning={slugCollisionWarning} />
    <WallpaperSection />
    <TextSection />
    <ButtonsSection />
    <SocialIconsSection />
    <LinksSection />
  </section>
);
