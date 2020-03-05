import commonjs from '@rollup/plugin-commonjs'

import resolve from '@rollup/plugin-node-resolve'
import visualizer from 'rollup-plugin-visualizer'
import sucrase from '@rollup/plugin-sucrase'
import path from "path"


import { external } from "./_external.config"

const output = `docs`

export default {
	input: `src/test/_test.ts`,
	treeshake: true,
	external: [
		...external,
		"ava"
	],

	output: {
		sourcemap: true,
		format: `cjs`,
		name: `app`,
		file: `${output}/bin/bundle.test.js`
	},

	plugins: [
		visualizer({
			filename: `docs/stats/test.html`
		}),

		resolve({
			browser: false,
			extensions: [`.js`, `.ts`],
			rootDir: path.join(process.cwd(), "..")
		}),

		sucrase({
			transforms: [`typescript`]
		}),

		commonjs({
			extensions: [".js", ".ts", ".json"]
		}),

	],

	watch: {
		clearScreen: true
	}
}
