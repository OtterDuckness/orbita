import { exigirApartado } from "@/lib/apartados";

export const dynamic = "force-dynamic";

export default async function CalendarioLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("calendario");
  return children;
}
