module.exports = {
	preprocess: require(`svelte-preprocess`)({
		typescript: {
			// skips type checking
			transpileOnly: true,
			compilerOptions: {
				"esModuleInterop": true
			}
		},
	})
}
