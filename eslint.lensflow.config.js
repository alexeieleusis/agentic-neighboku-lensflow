import tseslint from "typescript-eslint";
import lensflow from "eslint-plugin-lensflow";

const lensflowRules = Object.fromEntries(
  Object.keys(lensflow.rules).map((name) => [`lensflow/${name}`, "warn"]),
);

export default tseslint.config(
  { ignores: ["dist", "storybook-static"] },
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { lensflow },
    rules: lensflowRules,
  },
);
