import { permanentRedirect } from "next/navigation";

export default async function PermisosLegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string; usuario?: string; nuevo?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.perfil) q.set("perfil", sp.perfil);
  if (sp.usuario) q.set("usuario", sp.usuario);
  if (sp.nuevo) q.set("nuevo", sp.nuevo);
  const qs = q.toString();
  permanentRedirect(qs ? `/admin/permisos?${qs}` : "/admin/permisos");
}
