import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import rootImport from 'rollup-plugin-root-import'
import resolve from 'rollup-plugin-node-resolve'
import visualizer from 'rollup-plugin-visualizer'

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
	input: `src/_wheel/wheel.js`,
	treeshake: true,
	external: [
		`cuid`,
		`expr-eval`,
		`color`,
		`tone`,
		`twgl`,
		`piexifjs`
	],
	output: {
		sourcemap: !production,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/wheel.bundle.js`,
		globals: {
			cuid: `cuid`,
			color: `Color`,
			tone: `Tone`,
			"expr-eval": `exprEval`,
			twgl: `twgl`,
			piexifjs: `EXT.piexifjs`
		}
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
