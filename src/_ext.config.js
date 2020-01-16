import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import resolve from 'rollup-plugin-node-resolve'

import visualizer from 'rollup-plugin-visualizer'

const output = `docs`

export default {
	input: `src/_ext/index.js`,
	treeshake: false,
	output: {
		sourcemap: false,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/ext.bundle.js`
	},

	plugins: [
		visualizer({
			filename: `docs/external.html`
		}),

		commonjs(),
		resolve({ browser: true }),
		terser()
	],

	watch: {
		clearScreen: true
	}
}
