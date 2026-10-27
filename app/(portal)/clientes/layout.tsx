import { exigirApartado } from "@/lib/apartados";

export const dynamic = "force-dynamic";

export default async function ClientesLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("clientes");
  return children;
}
