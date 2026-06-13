import globals from "globals";
import base from "./base.js";

/**
 * Flat ESLint config for the Next.js web app. Extends the shared base and adds
 * browser globals. (Next's own plugin rules are intentionally light here to
 * keep the scaffold dependency surface small.)
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
