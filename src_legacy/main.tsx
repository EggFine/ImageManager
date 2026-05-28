import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/figtree";
import "@fontsource-variable/jetbrains-mono";
import "./styles/globals.css";
import { initI18n } from "./i18n";
import { loadConfig } from "./services/config";
import { useConfig } from "./services/store";
import App from "./App";

async function bootstrap() {
  const cfg = await loadConfig();
  await initI18n(cfg.language);
  await useConfig.getState().init();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch((e) => {
  console.error("Bootstrap failed", e);
  const root = document.getElementById("root");
  if (root) root.innerHTML = `<pre style="padding:24px;color:#c00">Bootstrap failed:\n${String(e)}</pre>`;
});
