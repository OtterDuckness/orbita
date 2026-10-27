import { exigirApartado } from "@/lib/apartados";

export const dynamic = "force-dynamic";

export default async function CorreoLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("correo");
  return children;
}
