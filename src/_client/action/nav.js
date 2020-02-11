import { buttons } from "/sys/input.js"

import { write } from "/store.js"
import { tick } from "/sys/time.js"

export const nav_map = {}
export const goto = (key) => {
	cursor.set(nav_map[key])
}
export const cursor = write(false)

window.addEventListener(`contextmenu`, (e) => {
	e.preventDefault()
	return false
})

let last_node
let last_button = {}

let origin_addr
const button_defs = {
	home: { repeat: true, fn: () => last_node.home || origin_addr },
	up: { repeat: true },
	down: { repeat: true },
	pagedown: { repeat: true, alias: `page_down` },
	pageup: { repeat: true, alias: `page_up` },
	cancel: {},
	insert: {},
	delete: { alias: `del` },
	left: {},
	right: {},
	confirm: { alias: `click` }
}

tick.listen(() => {
	if (!last_node) return

	const $button = buttons.get()

	let dest
	Object.entries(button_defs).forEach(([key, { repeat, fn, alias }]) => {
		alias = alias || key
		if (!$button[key] || !last_node[alias]) return

		// prevent repeat
		if (!repeat && last_button[key]) return

		if (fn) {
			dest = fn()
			return
		}

		if (typeof last_node[alias] === `function`) {
			dest = last_node[alias]()
			return
		}

		dest = last_node[alias]
	})

	last_button = { ...$button }
	if (!dest) return

	const target = nav_map[dest]
	if (!target) return

	// "instant" other option
	target.scrollIntoView({ block: `center` })
	cursor.set(target)
})

const current = ($node) => {
	// if ($node && $node.id !== undefined) window.location.hash = $node.id
	if (last_node) {
		if (last_node.classList) last_node.classList.remove(`nav`)
		last_node = false
	}

	if (!$node) return

	last_node = $node
	if ($node.focus) {
		$node.focus()
		$node.classList.add(`nav`)
	}
}

cursor.listen(current)

export default (node, opts) => {
	const { id, origin = false } = opts
	node.id = id

	const nav = {
		update: ({ up, down, page_up, page_down, insert, del, left, right }) => {
			// TODO: update to use button defs
			node.up = up || node.up
			node.left = left || node.left
			node.right = right || node.right
			node.down = down || node.down
			node.page_down = page_down || node.page_down
			node.page_up = page_up || node.page_up
			node.insert = insert || node.insert
			node.del = del || node.del
		},
		destroy: () => {
			node.removeEventListener(`mousedown`, listener)
			delete nav_map[id]
		}
	}

	nav.update(opts)

	nav_map[id] = node
	if (id === `sys` && cursor.get() === false) cursor.set(node)
	node.style.transition = `all 250ms linear`

	const listener = (e = false) => {
		cursor.set(node)

		if (e.which === 3) {
			e.preventDefault()
			e.stopPropagation()
			node.insert && node.insert()
			return
		}

		if (e.which === 2) {
			node.del && node.del()
		}
	}

	node.addEventListener(`mousedown`, listener)

	if (origin) {
		origin_addr = id
		listener()
	}

	return nav
}
