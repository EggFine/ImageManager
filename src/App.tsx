import { useEffect } from "react";
import { Shell } from "./components/Shell";
import { ToastProvider } from "./components/ui/Toast";
import { useConfig } from "./services/store";

function applyTheme(themeCfg: string) {
  const root = document.documentElement;
  const isDark =
    themeCfg === "dark" ||
    (themeCfg !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
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

  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
