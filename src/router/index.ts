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
    { path: "/generate", name: "generate", component: () => import("@/views/GenerateView.vue") },
    { path: "/edit", name: "edit", component: () => import("@/views/EditView.vue") },
    { path: "/history", name: "history", component: () => import("@/views/HistoryView.vue") },
    { path: "/settings", name: "settings", component: () => import("@/views/SettingsView.vue") },
  ],
});

export default router;
