import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Perch",
    version: "1.2.0",
    default_locale: "en",
    description: "A personal browser dashboard for your new tab.",
    permissions: ["storage", "activeTab", "tabs", "contextMenus", "bookmarks"],
    host_permissions: ["http://*/*", "https://*/*"],
    commands: {
      "add-current-page": {
        suggested_key: { default: "Ctrl+Shift+D", mac: "Command+Shift+D" },
        description: "Save current page to Perch",
      },
    },
  },
});
