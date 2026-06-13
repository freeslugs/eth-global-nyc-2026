import base from "@aegis/eslint-config/base";

export default [
  ...base,
  {
    // The sample upstream + scripts are plain JS fixtures, not linted as src.
    ignores: ["fixtures/**", "scripts/**"],
  },
];
