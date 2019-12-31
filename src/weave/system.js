import Weave from "./weave.js"

import { map, reduce } from "/util/object.js"

// lets grab all the systems here
import * as mouse from "/sys/mouse.js"
import * as time from "/sys/time.js"
import * as screen from "/sys/screen.js"
import * as input from "/sys/input.js"
import * as key from "/sys/key.js"
import * as flag from "/sys/flag.js"
import * as camera from "/sys/camera.js"

// private sytems
import "/sys/data.js"

const normalize = (sys) => map(flag)(
	([key, entry]) => [
		key.replace(/_/g, ` `).toLowerCase(),
		entry
	]
)

const tie = (items) => reduce(items)(
	(result, [key, value]) => ({
		...result,
		[key]: {
			type: `space`,
			value: {
				...value,
				[`!name`]: key
			}
		}
	}), {})

export default Weave({
	name: `sys`,
	id: `sys`,
	warps: tie({
		mouse,
		time,
		screen,
		input,
		key,
		flag: normalize(flag),
		camera
	})
})
