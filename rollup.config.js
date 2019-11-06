import svelte from 'rollup-plugin-svelte'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import json from "rollup-plugin-json"
import replaceHtmlVars from 'rollup-plugin-replace-html-vars'
import rootImport from 'rollup-plugin-root-import'

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
  input: `src/main.js`,
  output: {
    sourcemap: !production,
    format: `iife`,
    name: `app`,
    file: `${output}/bundle.js`
  },
  plugins: [
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

    resolve({ browser: true }),
    commonjs(),
    json(),

    production && terser()
  ],
  watch: {
    clearScreen: false
  }
}
