// Collection of meta controllers
import * as Mouse from "./mouse"
import * as Keyboard from "./keyboard"
import * as Gamepad from "./gamepad"
import * as Time from "src/sys/time"

import { v3 } from "twgl.js"

const { length, add, mulScalar } = v3

import { Read, Transformer } from "src/store"

document.addEventListener(`touchmove`, event => {
	if (event.scale !== 1) { event.preventDefault() }
}, { passive: false })

let lastTouchEnd = 0
document.addEventListener(`touchend`, event => {
	const now = (new Date()).getTime()
	if (now - lastTouchEnd <= 500) event.preventDefault()
	lastTouchEnd = now
}, { passive: false })

// input to replicate to remotes
const button_map = {
	home: ({ home }, { start }) => home || start,

	left: ({ arrowleft, a }, { left }) => a || arrowleft || left,
	right: ({ arrowright, d }, { right }) => d || arrowright || right,
	up: ({ arrowup, tab, shift, w }, { up }) => arrowup || (tab && shift) || up || w,
	down: ({ arrowdown, tab, shift, s }, { down }) => arrowdown || (tab && !shift) || down || s,
	pagedown: ({ pagedown }, { righttrigger }) => pagedown || righttrigger,
	pageup: ({ pageup, ' ': space, shift }, { rightshoulder }) => pageup || rightshoulder || (space && shift),

	insert: ({ insert, '=': equal }, { x }) => insert || x || equal,
	delete: ({ delete: del, backspace }, { y }) => del || y || backspace,
	confirm: ({ enter }, { a }) => a || enter,
	cancel: ({ end, escape }, { b }) => end || b || escape,
	editor: ({ pause, tilde }, { select }) => tilde || pause || select,

	undo: ({ control, z, backspace }) => (control && z) || backspace,
	redo: ({ shift, control, z, backspace, redo }) => redo || (shift && control && z) || (shift && backspace)
}

export const buttons = new Read<any>({}, (set) => {
	const values = {}
	Time.tick.listen(() => {
		const $keys = Keyboard.keys.get()
		const $buttons = Gamepad.buttons.get()

		Object.entries(button_map).forEach(([key, fn]) => {
			values[key] = fn($keys, $buttons)
		})

		set(values)
	})
})

export const button = new Read("", set => {
	Keyboard.key.listen(set)
})


// raw translate commands
export const translate = new Read([0, 0, 0], (set) => {
	const b_key = [0, 0, 0]
	// frame stuff has to be fast :/
	Time.tick.listen(() => {
		const { up, down, left, right } = buttons.get()

		b_key[0] = 0
		b_key[1] = 0
		b_key[2] = 0

		if (up) b_key[1] -= 1
		if (down) b_key[1] += 1
		if (left) b_key[0] -= 1
		if (right) b_key[0] += 1

		if (length(b_key) === 0) return

		set(b_key)
	})
})

let scroll_velocity = [0, 0, 0]

export const scroll = new Transformer([0,0], (data) => data.map((i) => Math.round(i)))

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
