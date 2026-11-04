import { createClient, type Client } from "@libsql/client";

let cliente: Client | null = null;

/** Cliente Turso reusado entre invocaciones (patron estandar serverless: el modulo se cachea
 * mientras la funcion sigue "caliente", evitar abrir una conexion nueva por request). */
export function db(): Client {
  if (!cliente) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error("Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN en el entorno del servidor.");
    }
    cliente = createClient({ url, authToken });
  }
  return cliente;
}

/** JSON.parse seguro para columnas TEXT que guardan arrays — NULL/vacio se vuelve arreglo vacio. */
export function parseJsonArray(valor: unknown): string[] {
  if (typeof valor !== "string" || !valor) return [];
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** JSON.parse seguro para columnas TEXT que guardan un objeto — NULL/vacio se vuelve undefined. */
export function parseJsonObject<T>(valor: unknown): T | undefined {
  if (typeof valor !== "string" || !valor) return undefined;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return undefined;
  }
}

/** 0/1 de SQLite -> boolean de JS. */
export function parseBool(valor: unknown): boolean {
  return valor === 1 || valor === "1" || valor === true;
}
