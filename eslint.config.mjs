import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'

// Intentionally minimal (see #93). This config enforces only two things:
//   - unused-imports/no-unused-imports: strip dead imports (auto-fixable)
//   - no-console: allow console.warn / console.error only
// It deliberately does NOT pull in the full typescript-eslint / eslint-plugin-vue
// recommended rulesets so the sweep stays small and the baseline stays green.
// Adopting @nuxt/eslint's fuller ruleset can be a later, separate PR.

const sharedRules = {
  'unused-imports/no-unused-imports': 'error',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
}

export default [
  {
    ignores: [
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'node_modules/**',
      'prisma/migrations/**',
      'public/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { 'unused-imports': unusedImports },
    rules: sharedRules,
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: { ...globals.browser },
    },
    plugins: { 'unused-imports': unusedImports },
    // Only no-console for .vue: unused-imports autofix is scoped to .ts/.js above
    // to avoid ever stripping an import that is used solely in a <template>.
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
