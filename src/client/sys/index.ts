import {Weave} from "src/weave"

// lets grab all the systems here
import * as mouse from "./mouse"
import * as time from "src/sys/time"
import * as screen from "./screen"
import * as input from "./input"
import * as keyboard from "./keyboard"
import * as gamepad from "./gamepad"
import * as flag from "./flag"
import * as camera from "./camera"
import * as device from "./device"

const normalize = (sys) => map(flag)(
	([k, entry]) => [
		k.replace(/ /g, `_`).toLowerCase(),
		entry
	]
)

const tie = (items) => Object.entries(items).reduce(
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
	keyboard,
	gamepad,
	device,
	flag: normalize(flag),
	camera
}

export default new Weave({
	name: `client`,
	value: tie(systems),
	rezed: Object.keys(systems)
})
