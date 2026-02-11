import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const banner = `/*!
 * @solo-pay/widget-js v0.1.0
 * (c) ${new Date().getFullYear()} MSQ Team
 * Released under the MIT License.
 */`;

// Shared typescript plugin config
const tsPlugin = (emitDeclarations = false) =>
  typescript({
    tsconfig: './tsconfig.json',
    declaration: emitDeclarations,
    declarationDir: emitDeclarations ? './dist' : undefined,
    compilerOptions: {
      // Prevent incremental builds that can cause hangs
      incremental: false,
    },
  });

export default [
  // IIFE build (for <script> tag) - also emits declarations
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
    plugins: [resolve(), tsPlugin(true)],
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
      tsPlugin(false),
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
    plugins: [resolve(), tsPlugin(false)],
  },
];
