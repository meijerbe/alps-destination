// Lint voor js/*.js — alleen de ene regel die een keer echt roet in het eten
// gooide (een `no-undef`) en dode code. Geen stijlregels: dat is Prettier's werk
// niet, en we hebben geen build-stap die het zou afdwingen.
//
// Draait vanuit de repo-root zodat "js/**/*.js" gewoon binnen de projectmap
// valt; eslint zelf staat als devDependency in tests/, dus lokaal:
//   cd tests && npx eslint -c ../eslint.config.mjs ../js
export default [
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly", document: "readonly", console: "readonly",
        localStorage: "readonly", sessionStorage: "readonly", navigator: "readonly",
        location: "readonly", history: "readonly", fetch: "readonly",
        AbortSignal: "readonly", URLSearchParams: "readonly", crypto: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
        Int16Array: "readonly", CSS: "readonly", confirm: "readonly", structuredClone: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { args: "none" }]
    }
  }
];
