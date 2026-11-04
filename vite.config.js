import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// Librerias grandes en chunks propios: el navegador las cachea aparte y un cambio en el codigo
// de la app no obliga a volver a descargar recharts en cada deploy.
const VENDOR_CHUNKS = {
    react: ["react", "react-dom", "react-router", "scheduler"],
    charts: ["recharts", "d3-", "victory-vendor"],
    radix: ["@radix-ui"],
};
export default defineConfig(({ mode }) => {
    // VITE_DEMO_MODE=true arranca la app con datos falsos + selector de rol (ver lib/modoDemo.ts).
    // En el deploy de produccion de Vercel eso nunca debe pasar sin querer: se detiene el build.
    // Para publicar una demo a proposito: VITE_ALLOW_DEMO=true.
    const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
    if (process.env.VERCEL_ENV === "production" && env.VITE_DEMO_MODE === "true" && env.VITE_ALLOW_DEMO !== "true") {
        throw new Error("VITE_DEMO_MODE=true en Vercel (Production): la app saldria en modo demo sin querer.");
    }
    return {
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (!id.includes("node_modules"))
                            return;
                        const ruta = id.split("node_modules/").pop() ?? "";
                        for (const [chunk, paquetes] of Object.entries(VENDOR_CHUNKS)) {
                            if (paquetes.some((p) => ruta.startsWith(p)))
                                return chunk;
                        }
                    },
                },
            },
        },
        server: {
            port: 5180,
            strictPort: true,
        },
    };
});
