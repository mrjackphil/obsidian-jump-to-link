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
                    allowDefaultProject: ["eslint.config.*"],
                },
            },
        },
    },
]);
