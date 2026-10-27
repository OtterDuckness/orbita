import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isEmailAllowed } from "@/lib/allowlist";
import { runWithProdDb } from "@/lib/db";
import {
  asegurarUsuario,
  guardarTokensGoogle,
  obtenerUsuarioAuthPorCorreo,
  registrarAccesoUsuario,
} from "@/lib/usuarios";

const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
/** Read + send + labels (mark read/unread). Supersedes gmail.readonly + gmail.send. */
const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: `openid email profile ${CALENDAR_EVENTS_SCOPE} ${GMAIL_MODIFY_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      // Identidad, tokens y último acceso siempre en la BD principal, no en sandbox.
      return await runWithProdDb(async () => {
        if (!isEmailAllowed(email)) {
          const existente = await obtenerUsuarioAuthPorCorreo(email);
          if (!existente || existente.rol !== "interna") return false;
        }

        try {
          const u = await asegurarUsuario({ nombre: user.name, correo: email });
          await registrarAccesoUsuario(u.id);
          if (account?.provider === "google") {
            await guardarTokensGoogle(email, {
              refreshToken: account.refresh_token,
              accessToken: account.access_token,
              expiry: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            });
          }
        } catch (error) {
          console.error("[auth] no se pudo asegurar usuario en DB", {
            correo: email,
            error,
          });
          return false;
        }
        return true;
      });
    },
    async session({ session }) {
      return session;
    },
  },
  trustHost: true,
});
