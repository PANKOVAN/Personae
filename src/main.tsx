import "@vscode/codicons/dist/codicon.css";
import "rsuite/dist/rsuite.min.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { dataModel } from "./store";

void dataModel.loadShelves();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
