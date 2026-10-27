import { AsyncLocalStorage } from "node:async_hooks";
import mysql, { type Pool } from "mysql2/promise";

const forzarProdAls = new AsyncLocalStorage<true>();

let poolProd: Pool | null = null;
let poolPruebas: Pool | null = null;

function nombreBdProd(): string {
  return process.env.DATABASE_NAME ?? "orbita";
}

function nombreBdPruebas(): string {
  return process.env.DATABASE_NAME_PRUEBAS ?? "orbita_pruebas";
}

function createPool(database: string): Pool {
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const instance = process.env.INSTANCE_CONNECTION_NAME;
  const host = process.env.DATABASE_HOST;

  if (!user || !password) {
    throw new Error("Faltan DATABASE_USER o DATABASE_PASSWORD");
  }

  // Local: DATABASE_HOST (IP). Cloud Run: INSTANCE_CONNECTION_NAME (socket).
  // Cloud SQL puede pedir mysql_clear_password; seguro en socket Unix / TLS.
  // DATETIME sin zona: interpretar/escribir siempre como UTC (independiente del OS).
  const comunes = {
    user,
    password,
    database,
    enableCleartextPlugin: true as const,
    waitForConnections: true as const,
    connectionLimit: 5,
    timezone: "Z" as const,
  };

  if (host) {
    return mysql.createPool({
      ...comunes,
      host,
      port: Number(process.env.DATABASE_PORT ?? "3306"),
    });
  }

  if (instance) {
    return mysql.createPool({
      ...comunes,
      socketPath: `/cloudsql/${instance}`,
    });
  }

  throw new Error("Falta DATABASE_HOST o INSTANCE_CONNECTION_NAME");
}

export function getPoolProd(): Pool {
  if (!poolProd) poolProd = createPool(nombreBdProd());
  return poolProd;
}

export function getPoolPruebas(): Pool {
  if (nombreBdPruebas() === nombreBdProd()) {
    throw new Error("DATABASE_NAME_PRUEBAS no puede ser la misma que DATABASE_NAME");
  }
  if (!poolPruebas) poolPruebas = createPool(nombreBdPruebas());
  return poolPruebas;
}

/** Login, tokens Google y cron: siempre la BD principal. */
export function runWithProdDb<T>(fn: () => T): T {
  return forzarProdAls.run(true, fn);
}

export async function getPool(): Promise<Pool> {
  if (forzarProdAls.getStore()) return getPoolProd();
  const { modoDb } = await import("@/lib/sandbox");
  const modo = await modoDb();
  return modo === "pruebas" ? getPoolPruebas() : getPoolProd();
}
