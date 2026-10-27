/**
 * Cliente Holded API v2 (Team & HR).
 * Auth: Authorization Bearer (https://www.holded.com/developers/authentication)
 *
 * Spike approve (1A): la referencia oficial de Time off solo documenta create / update end date /
 * list / get — sin endpoint “approve”. Por tanto la UI de aprobación queda deshabilitada hasta
 * que Holded lo exponga o una prueba con token real demuestre lo contrario.
 */

const BASE = "https://api.holded.com";

/** Documentado: no hay approve en Time off. Cambiar a true solo tras spike exitoso. */
export const HOLDED_TIME_OFF_APPROVE_SUPPORTED = false;

export class HoldedError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "HoldedError";
  }
}

function apiKey(): string {
  const key = process.env.HOLDED_API_KEY?.trim();
  if (!key) {
    throw new HoldedError("HOLDED_API_KEY no configurada", 0);
  }
  return key;
}

export function holdedConfigurado(): boolean {
  return Boolean(process.env.HOLDED_API_KEY?.trim());
}

async function holdedFetch<T>(
  path: string,
  init?: RequestInit & { raw?: boolean },
): Promise<T> {
  const key = apiKey();
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HoldedError(`Holded ${res.status}`, res.status, body.slice(0, 500));
  }

  if (init?.raw) {
    return res as unknown as T;
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export type HoldedEmployee = {
  id: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
};

export type HoldedTimeEntry = {
  id: string;
  employeeId?: string;
  start?: string | number;
  end?: string | number | null;
  [key: string]: unknown;
};

export type HoldedTimeOff = {
  id: string;
  employeeId?: string;
  status?: string;
  start?: string | number;
  end?: string | number;
  [key: string]: unknown;
};

export type HoldedPayslip = {
  id: string;
  employeeId?: string;
  [key: string]: unknown;
};

type ListEnvelope<T> = T[] | { data?: T[]; items?: T[] };

function asArray<T>(raw: ListEnvelope<T> | undefined): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  return [];
}

export async function listarEmpleados(limit = 50): Promise<HoldedEmployee[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  const raw = await holdedFetch<ListEnvelope<HoldedEmployee>>(`/api/v2/employees?${q}`);
  return asArray(raw);
}

export async function obtenerEmpleado(employeeId: string): Promise<HoldedEmployee> {
  return holdedFetch(`/api/v2/employees/${encodeURIComponent(employeeId)}`);
}

export async function ficharEntrada(employeeId: string): Promise<unknown> {
  return holdedFetch(`/api/v2/employees/${encodeURIComponent(employeeId)}/clock-in`, {
    method: "POST",
    body: "{}",
  });
}

export async function ficharSalida(employeeId: string): Promise<unknown> {
  return holdedFetch(`/api/v2/employees/${encodeURIComponent(employeeId)}/clock-out`, {
    method: "POST",
    body: "{}",
  });
}

export async function iniciarPausa(employeeId: string): Promise<unknown> {
  return holdedFetch(`/api/v2/employees/${encodeURIComponent(employeeId)}/pause`, {
    method: "POST",
    body: "{}",
  });
}

export async function finalizarPausa(employeeId: string): Promise<unknown> {
  return holdedFetch(`/api/v2/employees/${encodeURIComponent(employeeId)}/unpause`, {
    method: "POST",
    body: "{}",
  });
}

export async function listarTiemposEmpleado(employeeId: string): Promise<HoldedTimeEntry[]> {
  const raw = await holdedFetch<ListEnvelope<HoldedTimeEntry>>(
    `/api/v2/employees/${encodeURIComponent(employeeId)}/times`,
  );
  return asArray(raw);
}

export async function solicitarAusencia(
  employeeId: string,
  body: Record<string, unknown>,
): Promise<HoldedTimeOff> {
  return holdedFetch(`/api/v2/employees/${encodeURIComponent(employeeId)}/time-offs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listarAusenciasEmpleado(employeeId: string): Promise<HoldedTimeOff[]> {
  const raw = await holdedFetch<ListEnvelope<HoldedTimeOff>>(
    `/api/v2/employees/${encodeURIComponent(employeeId)}/time-offs`,
  );
  return asArray(raw);
}

export async function listarAusenciasTodas(): Promise<HoldedTimeOff[]> {
  const raw = await holdedFetch<ListEnvelope<HoldedTimeOff>>(`/api/v2/employees/time-offs`);
  return asArray(raw);
}

/**
 * Intento de aprobación (spike 1A). Solo se usa si HOLDED_TIME_OFF_APPROVE_SUPPORTED.
 * La API pública no documenta este contrato; se deja como stub explícito.
 */
export async function aprobarAusencia(
  employeeId: string,
  timeOffId: string,
): Promise<HoldedTimeOff> {
  if (!HOLDED_TIME_OFF_APPROVE_SUPPORTED) {
    throw new HoldedError("Aprobación de ausencias no soportada por la API Holded", 501);
  }
  return holdedFetch(
    `/api/v2/employees/${encodeURIComponent(employeeId)}/time-offs/${encodeURIComponent(timeOffId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    },
  );
}

export async function listarNominas(): Promise<HoldedPayslip[]> {
  const raw = await holdedFetch<ListEnvelope<HoldedPayslip>>(`/api/v2/payslips`);
  return asArray(raw);
}

export async function obtenerNomina(payslipId: string): Promise<HoldedPayslip> {
  return holdedFetch(`/api/v2/payslips/${encodeURIComponent(payslipId)}`);
}

export async function descargarPdfNomina(payslipId: string): Promise<Response> {
  return holdedFetch<Response>(`/api/v2/payslips/${encodeURIComponent(payslipId)}/pdf`, {
    raw: true,
    headers: { Accept: "application/pdf" },
  });
}

/** Smoke test: GET /employees. No loguea el token. */
export async function spikeHoldedEmpleados(): Promise<
  | { ok: true; status: 200; count: number }
  | { ok: false; status: number; motivo: string }
> {
  try {
    const list = await listarEmpleados(1);
    return { ok: true, status: 200, count: list.length };
  } catch (e) {
    if (e instanceof HoldedError) {
      return {
        ok: false,
        status: e.status,
        motivo:
          e.status === 0
            ? "sin_api_key"
            : e.status === 401
              ? "token_invalido"
              : e.status === 403
                ? "sin_permiso_hr"
                : `http_${e.status}`,
      };
    }
    return { ok: false, status: -1, motivo: "error_desconocido" };
  }
}
