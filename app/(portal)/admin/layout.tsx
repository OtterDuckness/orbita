import { exigirAdmin } from "@/lib/authz";
import { AdminTabs } from "./tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await exigirAdmin();

  return (
    <div>
      <AdminTabs />
      {children}
    </div>
  );
}
