import { exigirApartado } from "@/lib/apartados";

export const dynamic = "force-dynamic";

export default async function ProyectosLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("proyectos");
  return children;
}
