import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import rootImport from 'rollup-plugin-root-import'
import resolve from '@rollup/plugin-node-resolve'
import visualizer from 'rollup-plugin-visualizer'
import sucrase from '@rollup/plugin-sucrase'

import { external, globals} from "./_external.config"

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
	input: `src/goblin/_goblin.ts`,
	treeshake: true,
	external,
	output: {
		sourcemap: !production,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/goblin.bundle.js`,
		globals
	},

	plugins: [
		visualizer({
			filename: `docs/stats/goblin.html`
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
			transforms: [`typescript`]
		}),

		commonjs(),

		production && terser()
	],

	watch: {
		clearScreen: true
	}
}
