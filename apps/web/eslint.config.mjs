// Flat config for ESLint 9 + Next.js 15 (plain JS — no TS syntax in .mjs).
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  js.configs.recommended,
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts', 'coverage/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Media files live in S3/MinIO behind presigned URLs (user content) —
      // next/image optimization cannot apply, so plain <img> is intentional.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
