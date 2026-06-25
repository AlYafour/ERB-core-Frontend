import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
  ]),
  // Downgrade no-explicit-any to warn — remaining `any` casts are intentional
  // API boundary types (nested vs flat responses) pending full type generation.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      // React Compiler: preserve-manual-memoization fires when inferred deps differ from
      // hand-written deps; warn-only until all useCallback/useMemo are migrated.
      "react-hooks/preserve-manual-memoization": "warn",
      // set-state-in-effect: synchronous setState in useEffect (derived-state sync
      // pattern) is intentional in these components; warn-only pending refactor.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
