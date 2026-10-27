import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        magenta: "var(--magenta)",
        "magenta-texto": "var(--magenta-texto)",
        "magenta-suave": "var(--magenta-suave)",
        "magenta-borde": "var(--magenta-borde)",
        tinta: "var(--tinta)",
        papel: "var(--papel)",
        suave: "var(--suave)",
        linea: "var(--linea)",
        "linea-fuerte": "var(--linea-fuerte)",
        apagado: "var(--apagado)",
        novedad: "var(--novedad)",
        bien: "var(--bien)",
        "bien-suave": "var(--bien-suave)",
        "bien-borde": "var(--bien-borde)",
        mal: "var(--mal)",
        "mal-suave": "var(--mal-suave)",
        "mal-borde": "var(--mal-borde)",
        "mal-boton": "var(--mal-boton)",
        overlay: "var(--overlay)",
        "overlay-fuerte": "var(--overlay-fuerte)",
        anillo: "var(--anillo)",
        "fila-hover": "var(--fila-hover)",
      },
      boxShadow: {
        suave: "var(--sombra-suave)",
      },
      ringColor: {
        anillo: "var(--anillo)",
      },
      fontFamily: {
        display: ['"Red Hat Display"', "system-ui", "sans-serif"],
        cuerpo: ['"Josefin Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
