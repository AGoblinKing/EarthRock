import { read, write } from "/util/store.js"

export default ({
	value = 0
}) => ({
	knot: read(`sprite`),
	value: write(value)
})
