import globals from 'globals'
import babelParser from '@babel/eslint-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default [
  ...compat.extends('eslint:recommended', 'prettier'),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        kintone: true,
      },

      parser: babelParser,
      ecmaVersion: 6,
      sourceType: 'commonjs',

      parserOptions: {
        parser: '@babel/eslint-parser',
        sourceType: 'module',
        requireConfigFile: false,
      },
    },

    rules: {
      'no-console': 'off',
      'no-debugger': 'off',
      'arrow-parens': 'error',
      'arrow-spacing': 'error',
      'object-shorthand': 'error',
      'no-irregular-whitespace': 'off',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
    },
  },
]
