import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import rootImport from 'rollup-plugin-root-import'
import resolve from '@rollup/plugin-node-resolve'
import visualizer from 'rollup-plugin-visualizer'
import sucrase from '@rollup/plugin-sucrase'

import { external } from "./_external.config"

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
	input: `src/test/_test.ts`,
	treeshake: true,
	external,

	output: {
		sourcemap: !production,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/test.bundle.js`
	},

	plugins: [
		visualizer({
			filename: `docs/stats/test.html`
		}),

		rootImport({
			root: __dirname,
			useEntry: `prepend`
		}),

		resolve({
			browser: true,
			extensions: [`.js`, `.ts`]
		}),

		sucrase({
			exclude: [`node_modules/**`],
			transforms: [`typescript`]
		}),

		commonjs(),

		production && terser()
	],

	watch: {
		clearScreen: true
	}
}
