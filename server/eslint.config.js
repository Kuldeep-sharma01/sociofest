import { defineConfig } from 'eslint/config'

export default defineConfig({
  ignores: ['node_modules/**', 'uploads/**', 'python_modules/**', '**/python_modules/**', '**/venv/**'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaVersion: 'latest',
      ecmaFeatures: { jsx: true },
    },
  },
})
