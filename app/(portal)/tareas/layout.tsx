import { exigirApartado } from "@/lib/apartados";

export const dynamic = "force-dynamic";

export default async function TareasLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("tareas");
  return children;
}
