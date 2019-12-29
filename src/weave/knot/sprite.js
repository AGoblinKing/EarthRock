import { read, write } from "/util/store.js"

const knot = read(`sprite`)

export default ({
	value = 0
}) => ({
	knot,
	value: write(value)
})
