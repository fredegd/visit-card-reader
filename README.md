# Visit Cards OCR

Convert visit cards into structured contact data using Mistral OCR 3, with optional client-side OpenCV cropping and QR decoding.

## Features
- Supabase Auth + Postgres + Storage
- Upload front/back images
- OCR via Mistral OCR 3 (`mistral-ocr-2512`)
- QR code decoding + merge into extracted fields
- Cropped image handling (OpenCV.js)
- Export to vCard / CSV / JSON

## Local Setup
1. Install dependencies:

```bash
bun install
```

2. Configure environment variables:

this happens based on your own system

3. Apply database schema in Supabase SQL editor:

```sql
-- See supabase/schema.sql
```

4. Start dev server:

```bash
bun run dev
```

## Supabase Setup
- Create a private storage bucket named `card-images`
- Apply the RLS policies in `supabase/schema.sql`

## OpenCV.js (Client)
By default, the app loads OpenCV.js from the CDN. You can override by setting:

- `NEXT_PUBLIC_OPENCV_URL` to a custom URL

If you want to self-host, place `opencv.js` in `public/vendor/opencv.js` and set:

- `NEXT_PUBLIC_OPENCV_URL=/vendor/opencv.js`

## Vercel Deployment
1. Push the repo to GitHub.
2. Import the project into Vercel.
3. Configure environment variables in Vercel (Production + Preview):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_OPENCV_URL` (optional)
- `MISTRAL_API_KEY`
- `MISTRAL_OCR_MODEL` (optional, defaults to `mistral-ocr-2512`)
- `MISTRAL_API_URL` (optional)

4. Deploy.

## Notes
- Cropping and QR decode run in the browser. If OpenCV fails to load, the app will fall back to the original image for OCR.
- Multiple phone numbers are stored in `phones[]` and normalized to `primary_phone` for quick display.
