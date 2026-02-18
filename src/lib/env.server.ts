import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  MISTRAL_API_KEY: z.string().min(1),
  MISTRAL_OCR_MODEL: z.string().default("mistral-ocr-2512"),
  MISTRAL_API_URL: z.string().url().default("https://api.mistral.ai/v1/ocr"),
});

export const serverEnv = serverSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  MISTRAL_OCR_MODEL: process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-2512",
  MISTRAL_API_URL: process.env.MISTRAL_API_URL ?? "https://api.mistral.ai/v1/ocr",
});
