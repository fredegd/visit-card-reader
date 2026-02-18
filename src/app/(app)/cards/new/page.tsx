import UploadCardForm from "@/components/UploadCardForm";

export default function NewCardPage() {
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold">New visit card</h1>
        <p className="text-sm text-ink-500">
          Upload an image and let OCR do the heavy lifting.
        </p>
      </header>
      <UploadCardForm />
    </div>
  );
}
