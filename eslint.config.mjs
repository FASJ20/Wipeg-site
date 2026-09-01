// eslint-config-next 16 ships flat config directly — no FlatCompat needed.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
      "Images/**",
      "public/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default config;
