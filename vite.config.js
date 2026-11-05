import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
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
        plugins: [
            react(),
            // Instalable en movil (Agregar a pantalla de inicio). Solo cachea el "shell" estatico
            // (JS/CSS/iconos) para que abra rapido ya instalada — a proposito SIN runtimeCaching
            // para /api/*: los datos de trabajo (entregables, salidas...) cambian todo el dia y
            // nunca deben verse viejos, asi que esas llamadas siempre van derecho a la red, el
            // service worker no las toca.
            VitePWA({
                registerType: "autoUpdate",
                includeAssets: ["favicon.svg", "apple-touch-icon.png"],
                manifest: {
                    name: "AV Control",
                    short_name: "AV Control",
                    description: "Sistema de gestion audiovisual — Grupo Ortiz",
                    lang: "es",
                    theme_color: "#FFFFFF",
                    background_color: "#F6F8FB",
                    display: "standalone",
                    start_url: "/",
                    scope: "/",
                    icons: [
                        { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
                        { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
                        { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
                    ],
                },
                workbox: {
                    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
                    navigateFallback: "/index.html",
                    navigateFallbackDenylist: [/^\/api\//],
                    // Sin esto, un deploy nuevo se queda "esperando" en segundo plano hasta que
                    // se cierren TODAS las pestañas viejas — quien prueba un cambio recien
                    // publicado en una pestaña que ya tenia abierta sigue viendo la version
                    // vieja. Con esto, la pestaña abierta toma el bundle nuevo en el siguiente
                    // refresh (no hace falta cerrarla).
                    skipWaiting: true,
                    clientsClaim: true,
                },
            }),
        ],
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
