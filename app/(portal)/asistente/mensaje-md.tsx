"use client";

import { type ReactNode } from "react";

type Bloque =
  | { tipo: "p"; lineas: string[] }
  | { tipo: "h"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "ul"; items: string[] }
  | { tipo: "ol"; items: string[] }
  | { tipo: "pre"; texto: string }
  | { tipo: "tabla"; filas: string[][] };

export function MensajeMd({ texto }: { texto: string }) {
  const bloques = partir(texto);
  return (
    <div className="grid gap-2 min-w-0">
      {bloques.map((b, i) => (
        <Fragmento key={i} bloque={b} />
      ))}
    </div>
  );
}

function Fragmento({ bloque }: { bloque: Bloque }) {
  if (bloque.tipo === "h") {
    const cls = "font-semibold text-[14px] m-0";
    if (bloque.nivel === 1) return <h3 className={cls}>{inline(bloque.texto)}</h3>;
    if (bloque.nivel === 2) return <h4 className={cls}>{inline(bloque.texto)}</h4>;
    return <h5 className={cls}>{inline(bloque.texto)}</h5>;
  }
  if (bloque.tipo === "ul") {
    return (
      <ul className="list-disc pl-4 m-0 grid gap-0.5">
        {bloque.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </ul>
    );
  }
  if (bloque.tipo === "ol") {
    return (
      <ol className="list-decimal pl-4 m-0 grid gap-0.5">
        {bloque.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </ol>
    );
  }
  if (bloque.tipo === "pre") {
    return (
      <pre className="m-0 overflow-x-auto rounded-md border border-linea bg-papel px-2 py-1.5 text-[12.5px] font-mono whitespace-pre-wrap">
        {bloque.texto}
      </pre>
    );
  }
  if (bloque.tipo === "tabla") {
    const [cabeza, ...cuerpo] = bloque.filas;
    if (!cabeza?.length) return null;
    const cols = cabeza.length;
    return (
      <div className="overflow-x-auto -mx-1 rounded-md border border-linea bg-papel">
        <table className="tabla text-[13px] [&_th]:px-2 [&_td]:px-2 [&_th]:py-1.5 [&_td]:py-1.5">
          <thead>
            <tr>
              {cabeza.map((c, i) => (
                <th key={i}>{inline(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cuerpo.map((row, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }, (_, ci) => (
                  <td key={ci} className="whitespace-nowrap">
                    {inline(row[ci] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <p className="m-0">
      {bloque.lineas.map((ln, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {inline(ln)}
        </span>
      ))}
    </p>
  );
}

const MD_LINK_RE = /^\[([^\]]+)\]\((\S+?)(?:\s+"[^"]*")?\)$/;

function inline(texto: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re =
    /(`[^`]+`)|(\*\*[^*]+?\*\*)|(\[[^\]]+\]\([^)\s]+(?:\s+"[^"]*")?\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(texto))) {
    if (m.index > last) nodes.push(texto.slice(last, m.index));
    const [full, code, bold, link] = m;
    if (code) {
      const inner = code.slice(1, -1);
      // Model often wraps markdown links in backticks; prefer a real <a>.
      const asLink = nodoEnlace(inner, k);
      if (asLink) {
        nodes.push(asLink);
        k += 1;
      } else {
        nodes.push(
          <code
            key={k++}
            className="font-mono text-[12.5px] bg-papel border border-linea rounded px-1"
          >
            {inner}
          </code>,
        );
      }
    } else if (bold) {
      nodes.push(
        <strong key={k++} className="font-semibold">
          {inline(bold.slice(2, -2))}
        </strong>,
      );
    } else if (link) {
      nodes.push(nodoEnlace(full, k) ?? full);
      k += 1;
    }
    last = m.index + full.length;
  }
  if (last < texto.length) nodes.push(texto.slice(last));
  return nodes;
}

function nodoEnlace(md: string, key: number): ReactNode | null {
  const mm = md.trim().match(MD_LINK_RE);
  if (!mm) return null;
  const label = mm[1] ?? md;
  const href = (mm[2] ?? "").trim();
  if (!urlOk(href)) return label;
  return (
    <a
      key={key}
      href={href}
      className="text-magenta-texto underline underline-offset-2"
    >
      {label}
    </a>
  );
}

function urlOk(href: string) {
  return /^(https?:\/\/|\/|#)/i.test(href.trim());
}

function celdas(linea: string): string[] {
  let s = linea.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function esFilaTabla(linea: string) {
  const t = linea.trim();
  return t.startsWith("|") && t.includes("|", 1);
}

function esSeparador(linea: string) {
  if (!esFilaTabla(linea) && !/^\s*[-:| ]+$/.test(linea)) return false;
  const cs = celdas(linea);
  return cs.length > 0 && cs.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s/g, "")));
}

function partir(texto: string): Bloque[] {
  const lineas = texto.replace(/\r\n/g, "\n").split("\n");
  const out: Bloque[] = [];
  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i] ?? "";
    if (linea.startsWith("```")) {
      const buf: string[] = [];
      i += 1;
      while (i < lineas.length && !lineas[i]!.startsWith("```")) {
        buf.push(lineas[i]!);
        i += 1;
      }
      if (i < lineas.length) i += 1;
      out.push({ tipo: "pre", texto: buf.join("\n") });
      continue;
    }
    if (esFilaTabla(linea) && i + 1 < lineas.length && esSeparador(lineas[i + 1]!)) {
      const filas: string[][] = [celdas(linea)];
      i += 2;
      while (i < lineas.length && esFilaTabla(lineas[i]!)) {
        filas.push(celdas(lineas[i]!));
        i += 1;
      }
      out.push({ tipo: "tabla", filas });
      continue;
    }
    const mH = linea.match(/^(#{1,3})\s+(.+)$/);
    if (mH) {
      out.push({
        tipo: "h",
        nivel: mH[1]!.length as 1 | 2 | 3,
        texto: mH[2]!,
      });
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i]!)) {
        items.push(lineas[i]!.replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      out.push({ tipo: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*\d+\.\s+/.test(lineas[i]!)) {
        items.push(lineas[i]!.replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      out.push({ tipo: "ol", items });
      continue;
    }
    if (/^\s*$/.test(linea)) {
      i += 1;
      continue;
    }
    const p: string[] = [];
    while (i < lineas.length) {
      const ln = lineas[i]!;
      if (/^\s*$/.test(ln)) break;
      if (ln.startsWith("```")) break;
      if (esFilaTabla(ln) && i + 1 < lineas.length && esSeparador(lineas[i + 1]!)) break;
      if (/^(#{1,3})\s+/.test(ln)) break;
      if (/^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) break;
      p.push(ln);
      i += 1;
    }
    out.push({ tipo: "p", lineas: p });
  }
  return out;
}
