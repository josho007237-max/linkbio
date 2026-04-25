import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { safeJsonParse } from "@/lib/json/safe-json-parse";

export type GenericFormFieldValue = string | string[];

export type GenericFormSubmissionRecord = {
  submitted_at: string;
  slug: string;
  form_title: string;
  form_id: string;
  email: string;
  name: string;
  phone: string;
  responses_json: string;
  extra_fields: string;
  status: string;
};

type GenericFormSubmissionStore = {
  submissions: GenericFormSubmissionRecord[];
};

const GENERIC_FORM_SUBMISSIONS_FILE = path.join(
  process.cwd(),
  "data",
  "generic-form-submissions.dev.json",
);

const readGenericFormStore = async (): Promise<GenericFormSubmissionStore> => {
  try {
    const raw = await readFile(GENERIC_FORM_SUBMISSIONS_FILE, "utf8");
    return safeJsonParse<GenericFormSubmissionStore>(raw, {
      submissions: [],
    });
  } catch {
    return {
      submissions: [],
    };
  }
};

const writeGenericFormStore = async (next: GenericFormSubmissionStore): Promise<void> => {
  await mkdir(path.dirname(GENERIC_FORM_SUBMISSIONS_FILE), { recursive: true });
  await writeFile(GENERIC_FORM_SUBMISSIONS_FILE, JSON.stringify(next, null, 2), "utf8");
};

export const appendGenericFormSubmission = async (
  record: GenericFormSubmissionRecord,
): Promise<void> => {
  const current = await readGenericFormStore();
  current.submissions = [record, ...(current.submissions ?? [])];
  await writeGenericFormStore(current);
};

