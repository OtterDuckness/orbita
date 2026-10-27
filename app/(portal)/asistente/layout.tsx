import { exigirApartado } from "@/lib/apartados";

export const dynamic = "force-dynamic";

export default async function AsistenteLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("asistente");
  return children;
}
