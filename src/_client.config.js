import svelte from 'rollup-plugin-svelte'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import rootImport from 'rollup-plugin-root-import'
import resolve from '@rollup/plugin-node-resolve'
import glslify from 'rollup-plugin-glslify'
import visualizer from 'rollup-plugin-visualizer'
import replace from "replace-in-file"
import sucrase from '@rollup/plugin-sucrase'

const preprocess = require("../svelte.config")

import { external, globals} from "./_external.config"

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
	input: `src/client/_client.js`,
	treeshake: true,
	external,
	output: {
		sourcemap: !production,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/client.bundle.js`,
		globals
	},
	
	plugins: [
		visualizer({
			filename: `docs/stats/client.html`
		}),

		rootImport({
			root: __dirname,
			useEntry: `prepend`
		}),

		resolve({
			browser: true,
			extensions: [`.js`, `.ts`]
		}),

		svelte({
			dev: !production,
			css: css => {
				css.write(`${output}/bin/client.bundle.css`)
			},
			...preprocess
		}),

		sucrase({
			transforms: [`typescript`]
		}),

		glslify({
			basedir: `src/sys/shader`
		}),

		{
			buildEnd: () =>
				replace({
					files: `${output}/*.html`,
					from: /.js\?t=[0-9]+/g,
					to: `.js?t=${Date.now()}`
				})
		},

		commonjs({
			namedExports: {
				'svelte/easing/index.js': [`linear`]
			}
		}),

		production && terser()
	],

	watch: {
		clearScreen: true
	}
}
