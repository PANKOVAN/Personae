import "@vscode/codicons/dist/codicon.css";
import { App } from "./App";
import "./index.css";
import { CustomProvider } from "rsuite";
import "rsuite/dist/rsuite.min.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const el = document.getElementById("root");
if (!el) {
    throw new Error("#root not found");
}

createRoot(el).render(
    <StrictMode>
        <CustomProvider>
            <App />
        </CustomProvider>
    </StrictMode>,
);
