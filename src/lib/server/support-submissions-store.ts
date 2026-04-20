import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { safeJsonParse } from "@/lib/json/safe-json-parse";

export type SupportSubmissionKind = "deposit_issue" | "withdraw_issue";

export type SupportSubmissionFieldValue = string | string[];

export type SupportSubmissionRecord = {
  id: string;
  kind: SupportSubmissionKind;
  slug: string;
  linkId: string;
  formTitle: string;
  template: string;
  submittedAt: string;
  fields: Array<{
    id: string;
    label: string;
    value: SupportSubmissionFieldValue;
  }>;
  attachment?: {
    fileName: string;
    mimeType: string;
    size: number;
    relativePath: string;
  };
};

type SupportSubmissionStore = Record<SupportSubmissionKind, SupportSubmissionRecord[]>;

const SUPPORT_SUBMISSIONS_FILE = path.join(
  process.cwd(),
  "data",
  "support-submissions.dev.json",
);

const readSupportStore = async (): Promise<SupportSubmissionStore> => {
  try {
    const raw = await readFile(SUPPORT_SUBMISSIONS_FILE, "utf8");
    return safeJsonParse<SupportSubmissionStore>(raw, {
      deposit_issue: [],
      withdraw_issue: [],
    });
  } catch {
    return {
      deposit_issue: [],
      withdraw_issue: [],
    };
  }
};

const writeSupportStore = async (next: SupportSubmissionStore): Promise<void> => {
  await mkdir(path.dirname(SUPPORT_SUBMISSIONS_FILE), { recursive: true });
  await writeFile(SUPPORT_SUBMISSIONS_FILE, JSON.stringify(next, null, 2), "utf8");
};

export const appendSupportSubmission = async (
  kind: SupportSubmissionKind,
  record: SupportSubmissionRecord,
): Promise<void> => {
  const current = await readSupportStore();
  current[kind] = [record, ...(current[kind] ?? [])];
  await writeSupportStore(current);
};
