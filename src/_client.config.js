import svelte from 'rollup-plugin-svelte'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import replaceHtmlVars from 'rollup-plugin-replace-html-vars'
import rootImport from 'rollup-plugin-root-import'
import resolve from 'rollup-plugin-node-resolve'
import glslify from 'rollup-plugin-glslify'
import visualizer from 'rollup-plugin-visualizer'

const production = !process.env.ROLLUP_WATCH

const output = `docs`

export default {
	input: `src/_client/client.js`,
	treeshake: true,
	external: [
		`cuid`,
		`expr-eval`,
		`color`,
		`tone`,
		`twgl`,
		`piexifjs`,
		`scribbletune`
	],
	output: {
		sourcemap: !production,
		format: `iife`,
		name: `app`,
		file: `${output}/bin/client.bundle.js`,
		globals: {
			cuid: `cuid`,
			color: `Color`,
			tone: `Tone`,
			"expr-eval": `exprEval`,
			twgl: `twgl`,
			piexifjs: `EXT.piexifjs`,
			scribbletune: `scribble`
		}
	},

	plugins: [
		visualizer({
			filename: `docs/stats/client.html`
		}),

		rootImport({
			root: __dirname,
			useEntry: `prepend`
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

		replaceHtmlVars({
			files: `${output}/*.html`,
			from: /.js\?t=[0-9]+/g,
			to: `.js?t=${Date.now()}`
		}),

		commonjs({
			namedExports: {
				'svelte/easing/index.js': [`linear`]
			}
		}),
		resolve({ browser: true }),
		production && terser()
	],

	watch: {
		clearScreen: true
	}
}
