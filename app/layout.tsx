import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE_TEMA, parseTema } from "@/lib/tema";

export const metadata: Metadata = {
  title: "Órbita",
  description: "Portal de clientes, proyectos y tareas",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const tema = parseTema(jar.get(COOKIE_TEMA)?.value);

  return (
    <html lang="es" data-tema={tema}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800&family=Josefin+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
