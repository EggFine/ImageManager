import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Shell } from "./components/Shell";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { useConfig } from "./services/store";
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from "./services/updater";

function applyTheme(themeCfg: string) {
  const root = document.documentElement;
  const isDark =
    themeCfg === "dark" ||
    (themeCfg !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

/** Background updater probe — fires once a few seconds after launch so the
 *  initial render isn't slowed down. Stays silent when there's nothing to
 *  install, or when the user is offline / the endpoint isn't reachable. */
function UpdateProbe() {
  const { t } = useTranslation();
  const { push } = useToast();
  const fired = useRef(false);
  const setStatus = useConfig((s) => s.setStatus);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const timer = window.setTimeout(async () => {
      try {
        const info = await checkForUpdate();
        if (!info) return;
        push({
          title: t("updater.available", { version: info.version }),
          body: t("updater.availableBody"),
          intent: "info",
        });
        // Stash on window for the toast's "Install" affordance — see action below.
        (window as unknown as { __pendingUpdate?: UpdateInfo }).__pendingUpdate = info;
      } catch (e) {
        // Most common cause: endpoint not reachable (offline / no release yet).
        // We silently swallow — no need to spam the user.
        console.debug("[updater] check failed", e);
      }
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [push, t, setStatus]);

  return null;
}

export default function App() {
  const theme = useConfig((s) => s.config.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(theme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Expose downloadAndInstall on window so the toast notification can trigger
  // it without prop-drilling through Shell → Toast. Slight hack, kept simple.
  useEffect(() => {
    (window as unknown as { __installUpdate?: () => Promise<void> }).__installUpdate = async () => {
      const info = (window as unknown as { __pendingUpdate?: UpdateInfo }).__pendingUpdate;
      if (!info) return;
      await downloadAndInstall(info);
    };
  }, []);

  return (
    <ToastProvider>
      <UpdateProbe />
      <Shell />
    </ToastProvider>
  );
}
