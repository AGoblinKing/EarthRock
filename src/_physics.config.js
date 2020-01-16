import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import rootImport from 'rollup-plugin-root-import'
import resolve from 'rollup-plugin-node-resolve'
import visualizer from 'rollup-plugin-visualizer'

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
	input: `src/_physics/physics.js`,
	treeshake: true,
	output: {
		sourcemap: !production,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/physics.bundle.js`
	},

	plugins: [
		visualizer({
			filename: `docs/stats/physics.html`
		}),

		rootImport({
			root: `${__dirname}/src`,
			useEntry: `prepend`
		}),

		commonjs(),

		resolve({ browser: true }),
		production && terser()
	],

	watch: {
		clearScreen: true
	}
}
