import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    console.info("[telemetry]", JSON.stringify(payload));
  } catch {
    console.info("[telemetry] (unserializable payload)");
  }

  return NextResponse.json({ ok: true });
}
