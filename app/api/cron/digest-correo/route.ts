import { NextResponse } from "next/server";
import { runWithProdDb } from "@/lib/db";
import { ejecutarDigestCorreo } from "@/lib/digest-correo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  const alt = req.headers.get("x-cron-secret") ?? "";
  return alt === secret;
}

async function handle(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Falta RESEND_API_KEY" },
      { status: 503 },
    );
  }

  const resultado = await runWithProdDb(() => ejecutarDigestCorreo());
  return NextResponse.json({
    ok: true,
    ...resultado,
  });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
