import { defineConfig } from "vite";
import { mockBackend } from "./dev/mock-backend.js";

// mockBackend() is `apply: "serve"` and only engages when VITE_GAS_WEB_APP_URL
// is unset, so production builds and any real backend config are untouched.
export default defineConfig({
  plugins: [mockBackend()],
});
