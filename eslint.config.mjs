import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
    {
        ignores: ["main.js", "rollup.config.js", "node_modules/**"],
    },
    ...obsidianmd.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ["eslint.config.*", "vitest.config.*"],
                },
            },
        },
    },
    {
        // `prefer-create-el` points at the Obsidian element helpers, but the ones
        // reachable from a Node append what they create to that node. Both of
        // these files build DETACHED elements - a CodeMirror widget and a legacy
        // editor widget - so they have to use createElement. Covered by
        // tests/widgets.test.ts.
        files: ["src/cm6-widget/MarkWidget.ts", "src/utils/common.ts"],
        rules: {
            "obsidianmd/prefer-create-el": "off",
        },
    },
    {
        // Test code is not plugin code: it stands in for the app rather than
        // running inside it, so the plugin guidelines do not apply.
        files: ["tests/**"],
        rules: {
            "obsidianmd/prefer-create-el": "off",
            "obsidianmd/no-global-this": "off",
        },
    },
]);
