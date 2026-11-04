import type { VercelRequest, VercelResponse } from "@vercel/node";
import { manejarApi } from "../_shared/http.js";
import { borrarCookieSesion } from "../_shared/session.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }
    borrarCookieSesion(res);
    res.status(200).json({ ok: true });
  });
}
