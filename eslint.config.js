import js from "@eslint/js";
import globals from "globals";

/** Flat ESLint config for the DigiCom extension (vanilla JS, browser + extension globals). */
export default [
  js.configs.recommended,
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        chrome: "readonly",
        DigiComSettings: "readonly",
        DigiComDetection: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    ignores: ["extension/lib/**", "extension/models/**", "onnx_quantized/**", "dist/**"],
  },
];
