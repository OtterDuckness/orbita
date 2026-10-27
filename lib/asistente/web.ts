import type Anthropic from "@anthropic-ai/sdk";
import { usuarioPuede, type UsuarioAuth } from "@/lib/usuarios";

/** Max Anthropic web_search calls per Messages request. */
export const WEB_SEARCH_MAX_USES = 3;
/** Max Anthropic web_fetch calls per Messages request. */
export const WEB_FETCH_MAX_USES = 2;
/** Cap fetched page tokens so one URL cannot blow the context. */
export const WEB_FETCH_MAX_CONTENT_TOKENS = 20_000;

/** Optional CSV envs; empty = no domain filter (open web). */
function dominiosDesdeEnv(nombre: string): string[] | undefined {
  const raw = process.env[nombre]?.trim();
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export type ToolWebParam =
  | Anthropic.WebSearchTool20250305
  | {
      type: "web_fetch_20250910";
      name: "web_fetch";
      max_uses: number;
      max_content_tokens: number;
      citations: { enabled: true };
      allowed_domains?: string[];
      blocked_domains?: string[];
    };

/** Server tools for users with `asistente.web`. Empty otherwise. */
export function toolsWebParaUsuario(usuario: UsuarioAuth): ToolWebParam[] {
  if (!usuarioPuede(usuario, "asistente.web")) return [];

  const allowed = dominiosDesdeEnv("IA_WEB_ALLOWED_DOMAINS");
  const blocked = allowed ? undefined : dominiosDesdeEnv("IA_WEB_BLOCKED_DOMAINS");

  const search: Anthropic.WebSearchTool20250305 = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: WEB_SEARCH_MAX_USES,
    ...(allowed ? { allowed_domains: allowed } : {}),
    ...(blocked ? { blocked_domains: blocked } : {}),
  };

  const fetch: ToolWebParam = {
    type: "web_fetch_20250910",
    name: "web_fetch",
    max_uses: WEB_FETCH_MAX_USES,
    max_content_tokens: WEB_FETCH_MAX_CONTENT_TOKENS,
    citations: { enabled: true },
    ...(allowed ? { allowed_domains: allowed } : {}),
    ...(blocked ? { blocked_domains: blocked } : {}),
  };

  return [search, fetch];
}

/**
 * Shrink server-tool payloads before DB persist (fetch pages are huge).
 * Keeps client `tool_use` intact for API replay.
 */
export function acotarBloquesParaPersistir(
  blocks: Anthropic.ContentBlock[],
): Anthropic.ContentBlock[] {
  return blocks.map((b) => {
    const type = (b as { type?: string }).type;
    if (type === "web_search_tool_result" || type === "web_fetch_tool_result") {
      const id =
        "tool_use_id" in b && typeof (b as { tool_use_id: unknown }).tool_use_id === "string"
          ? (b as { tool_use_id: string }).tool_use_id
          : "";
      return {
        type,
        tool_use_id: id,
        content: { type: "text", text: "(resultado web omitido en historial)" },
      } as unknown as Anthropic.ContentBlock;
    }
    return b;
  });
}
