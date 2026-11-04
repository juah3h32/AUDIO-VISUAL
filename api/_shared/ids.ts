import { randomUUID } from "node:crypto";
import { db } from "./turso.js";

export function nuevoId(): string {
  return randomUUID();
}

/**
 * Folio secuencial via contador en la tabla `contadores` — equivalente de
 * `src/lib/folio.ts` (ahora muerto, vivia del lado del navegador contra Firestore). Aqui corre
 * en SERVIDOR, dentro del mismo request que crea el registro.
 *
 * Mecanica identica a la version Firestore: "lee el valor actual (o `inicio` si no existe el
 * contador), devuelve ESE valor, guarda actual+1 para la siguiente llamada" — por eso el primer
 * folio usa exactamente `inicio`, no `inicio+1`.
 */
export async function siguienteFolio(nombre: string, prefijo: string, inicio: number): Promise<string> {
  const cliente = db();
  const tx = await cliente.transaction("write");
  try {
    const actual = await tx.execute({ sql: "SELECT siguiente FROM contadores WHERE nombre = ?", args: [nombre] });
    const numero = actual.rows[0] ? Number(actual.rows[0].siguiente) : inicio;
    await tx.execute({
      sql: "INSERT INTO contadores (nombre, siguiente) VALUES (?, ?) ON CONFLICT(nombre) DO UPDATE SET siguiente = ?",
      args: [nombre, numero + 1, numero + 1],
    });
    await tx.commit();
    return `${prefijo}-${numero}`;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
