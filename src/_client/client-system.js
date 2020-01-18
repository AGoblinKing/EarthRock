import Weave from "/weave/weave.js"

import { map, reduce } from "/object.js"

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
import "/sys/physics.js"

const normalize = (sys) => map(flag)(
	([k, entry]) => [
		k.replace(/_/g, ` `).toLowerCase(),
		entry
	]
)

const tie = (items) => reduce(items)(
	(result, [k, value]) => ({
		...result,
		[k]: {
			type: `space`,
			value: {
				...value,
				[`!name`]: k
			}
		}
	}), {})

const systems = {
	mouse,
	time,
	screen,
	input,
	key,
	flag: normalize(flag),
	camera
}

export default Weave({
	name: `sys`,
	id: `sys`,
	warps: tie(systems),
	rezed: systems
})
