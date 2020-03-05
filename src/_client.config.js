import svelte from 'rollup-plugin-svelte'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import rootImport from 'rollup-plugin-root-import'
import resolve from '@rollup/plugin-node-resolve'
import glslify from 'rollup-plugin-glslify'
import visualizer from 'rollup-plugin-visualizer'
import replace from "replace-in-file"
import sucrase from '@rollup/plugin-sucrase'

import { external } from "./_external.config"

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
	input: `src/_client/client.ts`,
	treeshake: true,
	external,

	output: {
		sourcemap: !production,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/client.bundle.js`
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

		sucrase({
			transforms: [`typescript`]
		}),

		svelte({
			dev: !production,
			css: css => {
				css.write(`${output}/bin/client.bundle.css`)
			},
			onwarn: (warning, handler) => {
				if (warning.message.indexOf(`Wheel`) !== -1) return
				handler(warning)
			}
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
