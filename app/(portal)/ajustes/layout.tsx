import { AjustesTabs } from "./tabs";

export default function AjustesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <AjustesTabs />
      {children}
    </div>
  );
}
