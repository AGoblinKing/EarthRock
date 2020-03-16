import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'

import sucrase from '@rollup/plugin-sucrase'
import resolve from '@rollup/plugin-node-resolve'

import visualizer from 'rollup-plugin-visualizer'

const output = `docs`

export const external = [
	`cuid`,
	`expr-eval`,
	`color-js`,
	`tone`,
	`twgl.js`,
	`piexifjs`,
	`scribbletune`
]

export const globals = {
	"color-js": "Color",
	"twgl.js": "TWGL",
	"cuid": "Cuid",
	"piexifjs": "piexifjs"
}

export default {
	input: `src/external/_external.ts`,
	treeshake: true,

	output: {
		browser: true,
		sourcemap: false,
		format: `iife`,
		file: `${output}/bin/external.bundle.js`
	},

	plugins: [
		visualizer({
			filename: `docs/external.html`
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
		terser()
	],

	watch: {
		clearScreen: true
	}
}
