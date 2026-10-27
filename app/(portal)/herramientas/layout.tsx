import { exigirApartado } from "@/lib/apartados";

export const dynamic = "force-dynamic";

export default async function HerramientasLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("herramientas");
  return children;
}
