import { exigirApartado } from "@/lib/apartados";

export const dynamic = "force-dynamic";

export default async function ComunicacionesLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("comunicaciones");
  return children;
}
