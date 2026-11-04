import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { DEMO_MARCAS } from "@/data/demoData";
import type { Marca } from "@/types";

const COLECCION = "marcas";

let demoStore: Marca[] = [...DEMO_MARCAS];

export async function listarMarcas(): Promise<Marca[]> {
  if (!isFirebaseConfigured || !db) {
    return [...demoStore].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }
  const snap = await getDocs(query(collection(db, COLECCION), orderBy("creadoEn", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Marca);
}

export async function crearMarca(
  data: Omit<Marca, "id" | "assets" | "creadoEn" | "actualizadoEn">
): Promise<Marca> {
  const ahora = new Date().toISOString();

  if (!isFirebaseConfigured || !db) {
    const nueva: Marca = {
      ...data,
      id: `mrc-${Date.now()}`,
      assets: [],
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    demoStore = [nueva, ...demoStore];
    return nueva;
  }

  const nueva = { ...data, assets: [], creadoEn: ahora, actualizadoEn: ahora };
  const ref = await addDoc(collection(db, COLECCION), { ...nueva, creadoEn: serverTimestamp() });
  return { ...nueva, id: ref.id };
}

export async function actualizarMarca(id: string, cambios: Partial<Marca>): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    demoStore = demoStore.map((m) => (m.id === id ? { ...m, ...cambios } : m));
    return;
  }
  await updateDoc(doc(db, COLECCION, id), { ...cambios, actualizadoEn: new Date().toISOString() });
}

export async function eliminarMarca(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    demoStore = demoStore.filter((m) => m.id !== id);
    return;
  }
  await deleteDoc(doc(db, COLECCION, id));
}
