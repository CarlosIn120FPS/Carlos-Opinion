import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'graphify-out']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // ESLint por sí solo no ve que un identificador se usa dentro de JSX. Antes
      // se tapaba con varsIgnorePattern: '^[A-Z_]', que ignoraba TODOS los nombres
      // en mayúscula — así que ni detectaba imports realmente sin usar, ni salvaba
      // a `motion`, que va en minúscula. `npm run lint` llevaba fallando desde
      // entonces. Con jsx-uses-vars la regla funciona de verdad y el parche sobra.
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': 'error',
    },
  },
  {
    // Los ficheros de configuración se ejecutan en Node, no en el navegador:
    // vite.config.js lee process.env para decidir el `base` del build.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
])
