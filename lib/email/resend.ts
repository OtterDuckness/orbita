import { Resend } from "resend";

export type EnvioCorreoInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EnvioCorreoResultado =
  | { ok: true; id: string }
  | { ok: false; error: string };

function clienteResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function fromAddress(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  if (!raw) return "Órbita <onboarding@resend.dev>";
  if (raw.includes("<")) return raw;
  return `Órbita <${raw}>`;
}

export async function enviarCorreo(
  input: EnvioCorreoInput,
): Promise<EnvioCorreoResultado> {
  const resend = clienteResend();
  if (!resend) {
    return { ok: false, error: "Falta RESEND_API_KEY" };
  }
  const to = input.to.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: "Correo destinatario inválido" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: [to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      return { ok: false, error: error.message || "Error Resend" };
    }
    return { ok: true, id: data?.id ?? "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error enviando correo";
    return { ok: false, error: msg };
  }
}
