import svelte from 'rollup-plugin-svelte'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import livereload from 'rollup-plugin-livereload'
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
      // Will first look in `client/src/*` and then `common/src/*`.
      root: `${__dirname}/src`,
      useEntry: `prepend`
    }),
    svelte({
      // enable run-time checks when not in production
      dev: !production,
      // we'll extract any component CSS out into
      // a separate file — better for performance
      css: css => {
        css.write(`${output}/bundle.css`)
      }
    }),
    replaceHtmlVars({
      files: `${output}/*.html`,
      from: /.js\?t=[0-9]+/g,
      to: `.js?t=${Date.now()}`
    }),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration —
    // consult the documentation for details:
    // https://github.com/rollup/rollup-plugin-commonjs
    resolve({ browser: true }),
    commonjs(),
    json(),

    // Watch the `${output}` directory and refresh the
    // browser on changes when not in production
    !production && livereload(`${output}`),

    // If we're building for production (npm run build
    // instead of npm run dev), minify
    production && terser()
  ],
  watch: {
    clearScreen: false
  }
}
