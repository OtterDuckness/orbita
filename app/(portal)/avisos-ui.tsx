"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AVISOS } from "@/lib/avisos";

type AvisosCtx = {
  avisar: (codigo: string) => void;
};

const Ctx = createContext<AvisosCtx | null>(null);

export function useAvisos() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAvisos debe usarse dentro de AvisosProvider");
  return ctx;
}

export function useAvisosOpcional() {
  return useContext(Ctx);
}

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [montado, setMontado] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoUrlRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const cerrar = useCallback(() => {
    setCodigo(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const avisar = useCallback((nuevo: string) => {
    if (!AVISOS[nuevo]) return;
    setCodigo(nuevo);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCodigo(null), 4000);
  }, []);

  useEffect(() => {
    setMontado(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const desdeUrl = searchParams.get("aviso");
    if (!desdeUrl || !AVISOS[desdeUrl]) return;
    const clave = `${pathname}?${desdeUrl}`;
    if (ultimoUrlRef.current === clave) return;
    ultimoUrlRef.current = clave;
    avisar(desdeUrl);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("aviso");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, avisar]);

  const aviso = codigo ? AVISOS[codigo] : null;

  return (
    <Ctx.Provider value={{ avisar }}>
      {children}
      {montado && aviso
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              className={`fixed z-[200] top-6 right-6 w-[min(100%-2rem,28rem)]
                rounded-[10px] border px-4 py-3 text-[13px] shadow-suave flex items-start gap-3 bg-papel
                transition-[opacity,transform] duration-200 ease-out
                ${
                  aviso.tono === "bien"
                    ? "border-bien-borde text-bien"
                    : "border-mal-borde text-mal"
                }`}
            >
              <p className="flex-1 min-w-0 leading-snug">{aviso.texto}</p>
              <button
                type="button"
                onClick={cerrar}
                className="shrink-0 text-[16px] leading-none opacity-60 hover:opacity-100 px-0.5"
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </div>,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}
