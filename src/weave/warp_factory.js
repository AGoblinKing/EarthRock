import uuid from "cuid"
import * as warps from "./warps.js"

// the basic warp
export default ({
	id = uuid(),
	type,
	knot,
	...rest
} = false) => {
	// TODO: Remove allows for conversion of old warps
	if (!type && knot) type = knot

	// TODO: Allows conversion from stitch to space
	if (type === `stitch`) {
		type = `space`
		rest.value = rest.value || {}
		rest.value[`!name`] = rest.name
	}

	const factory = warps[type]

	if (!factory) {
		console.warn(`Invalid warp ${type}`)
		return false
	}

	return warps[type]({
		...rest,
		id
	})
}
