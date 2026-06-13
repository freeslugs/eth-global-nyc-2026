import base from "@aegis/eslint-config/base";

export default [
  ...base,
  {
    // Fixture artifacts + the generator are sample/build files, not src.
    ignores: ["fixtures/**", "scripts/**"],
  },
];
