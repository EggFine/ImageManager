import { createRouter, createWebHashHistory } from "vue-router";

/**
 * Tauri serves the SPA from a `tauri://` scheme — `createWebHistory` would
 * produce paths that don't survive the bundle. `createWebHashHistory` keeps
 * everything in the URL fragment which the WebView always handles.
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: () => import("@/views/HomeView.vue") },
    // Single "create" view: handles both generation (no images) and
    // editing (with images) — the API endpoint is chosen at submit time
    // based on `imagePaths.length`. /generate and /edit are kept as
    // permanent redirects so older sidebar / banner clicks keep working
    // until everything is migrated.
    { path: "/create", name: "create", component: () => import("@/views/CreateView.vue") },
    { path: "/generate", redirect: "/create" },
    { path: "/edit", redirect: "/create" },
    { path: "/history", name: "history", component: () => import("@/views/HistoryView.vue") },
    {
      path: "/history/:id",
      name: "history-detail",
      component: () => import("@/views/HistoryDetailView.vue"),
      props: true,
    },
    { path: "/settings", name: "settings", component: () => import("@/views/SettingsView.vue") },
  ],
});

export default router;
