export type OcrInput = {
  imageUrl?: string;
  base64?: string;
  mimeType?: string;
};

export type OcrResult = {
  text: string;
  raw: unknown;
};

export interface OcrClient {
  name: string;
  process(input: OcrInput): Promise<OcrResult>;
}
