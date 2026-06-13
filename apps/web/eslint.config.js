import next from "@aegis/eslint-config/next";

export default [
  ...next,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];
