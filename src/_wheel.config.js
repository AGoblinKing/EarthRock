import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import rootImport from 'rollup-plugin-root-import'
import resolve from 'rollup-plugin-node-resolve'
import visualizer from 'rollup-plugin-visualizer'

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
	input: `src/_wheel/wheel_worker.js`,
	treeshake: true,
	output: {
		sourcemap: !production,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/wheel.bundle.js`
	},

	plugins: [
		visualizer({
			filename: `docs/stats/physics.html`
		}),

		rootImport({
			root: __dirname,
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
