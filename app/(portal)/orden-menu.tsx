"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAvisosOpcional } from "./avisos-ui";
import { guardarOrdenMenu } from "./ajustes/acciones";

export type SeccionNav = { href: string; nombre: string; id: string };

type OrdenCtx = {
  secciones: SeccionNav[];
  items: SeccionNav[];
  editando: boolean;
  guardando: boolean;
  fallo: boolean;
  entrar: () => void;
  cancelar: () => void;
  guardar: () => void;
  reordenar: (desdeId: string, haciaId: string, antes: boolean) => void;
};

const Ctx = createContext<OrdenCtx | null>(null);

export function useOrdenMenu() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOrdenMenu debe usarse dentro de OrdenMenuProvider");
  return ctx;
}

function mover(lista: SeccionNav[], desdeId: string, haciaId: string, antes: boolean) {
  if (desdeId === haciaId) return lista;
  const next = [...lista];
  const desde = next.findIndex((s) => s.id === desdeId);
  if (desde < 0) return lista;
  const [item] = next.splice(desde, 1);
  let hacia = next.findIndex((s) => s.id === haciaId);
  if (hacia < 0) return lista;
  if (!antes) hacia += 1;
  next.splice(hacia, 0, item);
  return next;
}

export function OrdenMenuProvider({
  secciones,
  children,
}: {
  secciones: SeccionNav[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const avisos = useAvisosOpcional();
  const [items, setItems] = useState(secciones);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const editandoRef = useRef(false);
  const serialProp = secciones.map((s) => s.id).join("|");
  const serialVisto = useRef(serialProp);

  editandoRef.current = editando;

  useEffect(() => {
    if (serialVisto.current === serialProp) return;
    serialVisto.current = serialProp;
    if (!editandoRef.current) setItems(secciones);
  }, [serialProp, secciones]);

  useEffect(() => {
    if (!editando) return;
    if (!pathname.startsWith("/ajustes")) {
      setItems(secciones);
      setFallo(false);
      setEditando(false);
    }
  }, [pathname, editando, secciones]);

  const entrar = useCallback(() => {
    setItems(secciones);
    setFallo(false);
    setEditando(true);
  }, [secciones]);

  const cancelar = useCallback(() => {
    setItems(secciones);
    setFallo(false);
    setEditando(false);
  }, [secciones]);

  const guardar = useCallback(async () => {
    if (guardando) return;
    setGuardando(true);
    setFallo(false);
    try {
      const r = await guardarOrdenMenu(items.map((s) => s.id));
      if (!r.ok) {
        setFallo(true);
        return;
      }
      setEditando(false);
      avisos?.avisar("menu_guardado");
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }, [avisos, guardando, items, router]);

  const reordenar = useCallback((desdeId: string, haciaId: string, antes: boolean) => {
    setItems((prev) => mover(prev, desdeId, haciaId, antes));
  }, []);

  return (
    <Ctx.Provider
      value={{
        secciones,
        items,
        editando,
        guardando,
        fallo,
        entrar,
        cancelar,
        guardar,
        reordenar,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
