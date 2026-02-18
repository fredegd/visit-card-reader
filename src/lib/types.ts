export type CardStatus = "uploaded" | "processing" | "ready" | "error";

export type LabeledValue = {
  label?: string;
  value: string;
};

export type ContactValue = string | LabeledValue;

export type ExtractedContact = {
  name?: string;
  company?: string;
  title?: string;
  emails?: string[];
  phones?: ContactValue[];
  faxes?: ContactValue[];
  websites?: string[];
  address?: ContactValue[] | string;
  notes?: string;
  raw_text?: string;
};

export type NormalizedContact = {
  full_name?: string;
  company?: string;
  title?: string;
  primary_email?: string;
  primary_phone?: string;
  primary_website?: string;
};

export type CardRecord = {
  id: string;
  user_id: string;
  status: CardStatus;
  extracted_json: ExtractedContact | null;
  normalized: NormalizedContact | null;
  full_name: string | null;
  company: string | null;
  title: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  primary_website: string | null;
  raw_ocr: unknown | null;
  raw_qr?: unknown | null;
  provider: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CardImageRecord = {
  id: string;
  user_id: string;
  card_id: string;
  side: "front" | "back";
  storage_path: string;
  cropped_path?: string | null;
  cropped_width?: number | null;
  cropped_height?: number | null;
  crop_confidence?: number | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  checksum: string | null;
  created_at: string;
  updated_at: string;
};
