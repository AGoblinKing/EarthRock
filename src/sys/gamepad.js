// eventually will want to support local multiplayer with this
// piping input to an alias map to a controller's actions
import { tick } from "/sys/time.js"
import { read } from "/store.js"

const pads = {}

window.addEventListener(`gamepadconnected`, ({ gamepad }) => {
	pads[gamepad.id] = gamepad
})

window.addEventListener(`gamepaddisconnected`, ({ gamepad }) => {
	delete pads[gamepad.id]
})

let axes_set
export const axes = read({}, (set) => {
	axes_set = set
})

const xbox = {
	0: `a`,
	1: `b`,
	2: `x`,
	3: `y`,
	4: `leftshoulder`,
	5: `rightshoulder`,
	6: `lefttrigger`,
	7: `righttrigger`,
	8: `select`,
	9: `start`,
	10: `leftstick`,
	11: `rightstick`,
	12: `up`,
	13: `down`,
	14: `left`,
	15: `right`
}

const xbox_axis = {
	0: `lefthorizontal`,
	1: `leftvertical`,
	2: `righthorizontal`,
	3: `rightvertical`
}

export const button = read({}, (set) => {
	const last = {}

	tick.listen(() => {
		const gps = navigator.getGamepads()
		for (let i = 0; i < gps.length; i++) {
			const pad = gps[i]
			if (pad === null) continue

			pad.buttons.forEach(({ pressed }, bdx) => {
				const key = xbox[bdx]
				if (key && last[key] !== pressed) {
					set(
						pressed
							? xbox[bdx]
							: `${xbox[bdx]}!`
					)

					last[key] = pressed
				}
			})

			const $axes = axes.get()

			pad.axes.forEach((axis, adx) => {
				const key = xbox_axis[axis]
				if (key && $axes[key] !== axis) {
					$axes[key] = axis
				}
			})

			axes_set($axes)
		}
	})
})

export const buttons = read({}, (set) => {
	const value = {}

	button.listen(($button) => {
		if ($button[$button.length - 1] === `!`) {
			value[$button.slice(0, -1)] = false
		} else {
			value[$button] = true
		}
		set(value)
	})
})
