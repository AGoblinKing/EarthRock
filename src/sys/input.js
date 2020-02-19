// Collection of meta controllers
import * as Mouse from "/sys/mouse.js"
import * as Key from "/sys/key.js"
import * as Time from "/sys/time.js"
import * as Gamepad from "/sys/gamepad.js"

import { v3 } from "twgl.js"

const { length, add, mulScalar } = v3

import { read, transformer } from "/store.js"

document.addEventListener(`touchmove`, event => {
	if (event.scale !== 1) { event.preventDefault() }
}, { passive: false })

let lastTouchEnd = 0
document.addEventListener(`touchend`, event => {
	const now = (new Date()).getTime()
	if (now - lastTouchEnd <= 500) event.preventDefault()
	lastTouchEnd = now
}, { passive: false })

// raw translate commands
export const translate = read([0, 0, 0], (set) => {
	const b_key = [0, 0, 0]
	// frame stuff has to be fast :/
	Time.frame.listen(() => {
		const { w, a, s, d, q, e } = Key.keys.get()

		b_key[0] = 0
		b_key[1] = 0
		b_key[2] = 0

		if (w) b_key[1] -= 1
		if (s) b_key[1] += 1
		if (a) b_key[0] -= 1
		if (d) b_key[0] += 1
		if (q) b_key[2] += 1
		if (e) b_key[2] -= 1

		if (length(b_key) === 0) return

		set(b_key)
	})
})

let scroll_velocity = [0, 0, 0]

export const scroll = transformer((data) => data.map((i) => Math.round(i)))

scroll.set([0, 0, 0])

Time.tick.listen(() => {
	if (Math.abs(length(scroll_velocity)) < 1) return

	scroll.set(add(
		scroll.get(),
		scroll_velocity
	).map((n) => Math.round(n)))

	scroll_velocity = mulScalar(
		scroll_velocity,
		0.25
	)
})

Mouse.scroll.listen((vel) => {
	scroll_velocity = add(scroll_velocity, vel)
})

// input to replicate to remotes
const button_map = {
	home: ({ home }, { start }) => home || start,
	up: ({ arrowup, tab, shift }, { up }) => arrowup || (tab && shift) || up,
	down: ({ arrowdown, tab, shift }, { down }) => arrowdown || (tab && !shift) || down,
	pagedown: ({ pagedown, ' ': space, shift }, { righttrigger }) => pagedown || righttrigger || (space && !shift),
	pageup: ({ pageup, ' ': space, shift }, { rightshoulder }) => pageup || rightshoulder || (space && shift),
	insert: ({ insert, '=': equal }, { x }) => insert || x || equal,
	delete: ({ delete: del, backspace }, { y }) => del || y || backspace,
	left: ({ arrowleft }, { left }) => arrowleft || left,
	right: ({ arrowright }, { right }) => arrowright || right,
	confirm: ({ enter }, { a }) => a || enter,
	cancel: ({ end, escape }, { b }) => end || b || escape,
	editor: ({ pause, tilde }, { select }) => tilde || pause || select,
	undo: ({ control, z, backspace }) => (control && z) || backspace,
	redo: ({ shift, control, z, backspace, redo }) => redo || (shift && control && z) || (shift && backspace)
}

export const buttons = read({}, (set) => {
	const values = {}
	Time.tick.listen(() => {
		const $keys = Key.keys.get()
		const $buttons = Gamepad.buttons.get()

		Object.entries(button_map).forEach(([key, fn]) => {
			values[key] = fn($keys, $buttons)
		})

		set(values)
	})
})
