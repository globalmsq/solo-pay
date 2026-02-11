import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const banner = `/*!
 * @solo-pay/widget-js v0.1.0
 * (c) ${new Date().getFullYear()} MSQ Team
 * Released under the MIT License.
 */`;

export default [
  // IIFE build (for <script> tag)
  {
    input: 'src/iife.ts',
    output: {
      file: 'dist/widget.js',
      format: 'iife',
      name: 'SoloPay',
      exports: 'default',
      banner,
      sourcemap: true,
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist',
      }),
    ],
  },
  // Minified IIFE build
  {
    input: 'src/iife.ts',
    output: {
      file: 'dist/widget.min.js',
      format: 'iife',
      name: 'SoloPay',
      exports: 'default',
      banner,
      sourcemap: true,
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser({
        format: {
          comments: /^!/,
        },
      }),
    ],
  },
  // ESM build (for import)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/widget.mjs',
      format: 'es',
      banner,
      sourcemap: true,
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
  },
];
