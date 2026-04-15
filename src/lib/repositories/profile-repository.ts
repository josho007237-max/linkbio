import { mockBuilderData } from "@/features/builder/mock-data";
import { BuilderData } from "@/features/builder/types";

export interface ProfileRepository {
  getProfileByUsername: (username: string) => Promise<BuilderData | null>;
}

export class MockProfileRepository implements ProfileRepository {
  async getProfileByUsername(username: string): Promise<BuilderData | null> {
    if (!username) {
      return null;
    }

    return {
      ...mockBuilderData,
      header: {
        ...mockBuilderData.header,
        username,
      },
    };
  }
}

// Swap this implementation later with a Supabase-backed repository.
export const profileRepository: ProfileRepository = new MockProfileRepository();

