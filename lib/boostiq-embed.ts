/**
 * Mint de token embed contra Boostiq (server-to-server).
 * Env: BOOSTIQ_ADMIN_BASE_URL, BOOSTIQ_EMBED_SECRET (mismo valor que ORBITA_EMBED_SECRET en Boostiq).
 */

export function boostiqAdminBaseUrl(): string {
  const raw = (process.env.BOOSTIQ_ADMIN_BASE_URL || "").trim().replace(/\/$/, "");
  return raw;
}

export function boostiqEmbedSecret(): string {
  return (process.env.BOOSTIQ_EMBED_SECRET || process.env.ORBITA_EMBED_SECRET || "").trim();
}

export async function mintBoostiqEmbedUrl(email: string): Promise<
  | { ok: true; url: string }
  | { ok: false; motivo: "sin_config" | "boostiq_error"; detalle?: string }
> {
  const base = boostiqAdminBaseUrl();
  const secret = boostiqEmbedSecret();
  if (!base || !secret) {
    return { ok: false, motivo: "sin_config" };
  }

  const res = await fetch(`${base}/api/admin/orbita-embed/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-orbita-embed-secret": secret,
    },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    embedToken?: string;
    error?: string;
  };

  if (!res.ok || !data.embedToken) {
    return {
      ok: false,
      motivo: "boostiq_error",
      detalle: data.error || `HTTP ${res.status}`,
    };
  }

  // Hash (no query `token=`): Chrome/WAF suelen strippear ?token= en iframes cross-site.
  const url = `${base}/admin/tickets?embed=1#orbita_embed=${encodeURIComponent(data.embedToken)}`;
  return { ok: true, url };
}
