import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@personae/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
        },
    },
    server: {
        proxy: {
            "/api": "http://127.0.0.1:3000",
            "/data": "http://127.0.0.1:3000",
        },
    },
});
