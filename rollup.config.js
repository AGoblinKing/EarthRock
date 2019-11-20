import svelte from 'rollup-plugin-svelte'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import replaceHtmlVars from 'rollup-plugin-replace-html-vars'
import rootImport from 'rollup-plugin-root-import'
import resolve from 'rollup-plugin-node-resolve'

const production = false && !process.env.ROLLUP_WATCH

const output = `docs`

export default {
  input: `src/main.js`,
  treeshake: true,
  external: [
    `cuid`,
    `expr-eval`,
    `color`,
    `tone`,
    `twgl`
  ],
  output: {
    sourcemap: !production,
    format: `iife`,
    name: `app`,
    file: `${output}/bundle.js`,
    globals: {
      cuid: `cuid`,
      color: `Color`,
      tone: `Tone`,
      "expr-eval": `exprEval`,
      twgl: `twgl`
    }
  },

  plugins: [
    // stats && visualizer({
    //   filename: `docs/stats.html`
    // }),

    rootImport({
      root: `${__dirname}/src`,
      useEntry: `prepend`
    }),

    svelte({
      dev: !production,
      css: css => {
        css.write(`${output}/bundle.css`)
      }
    }),

    replaceHtmlVars({
      files: `${output}/*.html`,
      from: /.js\?t=[0-9]+/g,
      to: `.js?t=${Date.now()}`
    }),

    commonjs({
      namedExports: {
        'svelte/easing/index.js': [`linear`]
      }
    }),
    resolve({ browser: true }),
    production && terser()
  ],

  watch: {
    clearScreen: true
  }
}
