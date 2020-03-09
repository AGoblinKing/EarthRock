import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import visualizer from 'rollup-plugin-visualizer'
import sucrase from '@rollup/plugin-sucrase'
import path from "path"
import npm from "npm"

import { external } from "./_external.config"

export default {
	input: `src/test/_test.ts`,
	treeshake: false,
	
	external: [
		...external,
		"ava"
	],

	output: {
		sourcemap: true,
		format: `cjs`,
		name: `app`,
		file: `src/test/bundle.test.js`
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

		{
			writeBundle() {
				npm.load(() => npm.run("test"))
			}
		}
	],

	watch: {
		clearScreen: true
	}
}
