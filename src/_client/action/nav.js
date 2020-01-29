import { keys } from "/sys/key.js"
import { write } from "/store.js"
import { tick } from "/sys/time.js"

export const nav_map = {}
export const cursor = write(false)

let last_node

let origin_addr
tick.listen(() => {
	if (!last_node) return

	const $keys = keys.get()

	// TODO: Keybind system
	let dest
	if ($keys.home) dest = origin_addr
	if ($keys.arrowup) dest = last_node.up
	if ($keys.arrowdown) dest = last_node.down
	if ($keys.pagedown) dest = last_node.page_down
	if ($keys.pageup) dest = last_node.page_up
	if ($keys.insert && last_node.insert) last_node.insert()
	if ($keys.delete && last_node.del) last_node.del()
	if ($keys.arrowleft && last_node.left) last_node.left()
	if ($keys.arrowright && last_node.right) last_node.right()
	if ($keys.enter) {
		last_node.click()
	}
	if (!dest) return

	const target = nav_map[dest]
	if (!target) return

	// "instant" other option
	target.scrollIntoView({ block: `center` })
	cursor.set(target)
})

const current = ($node) => {
	if (last_node) {
		last_node.classList.remove(`nav`)
		last_node = false
	}

	if (!$node) return

	last_node = $node
	$node.focus()
	$node.classList.add(`nav`)
}

cursor.listen(current)

export default (node, opts) => {
	const { id, origin = false } = opts
	node.id = id

	const nav = {
		update: ({ up, down, page_up, page_down, insert, del, left, right }) => {
			node.up = up
			node.left = left
			node.right = right
			node.down = down
			node.page_down = page_down
			node.page_up = page_up
			node.insert = insert
			node.del = del
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

	const listener = () => {
		cursor.set(node)
	}

	node.addEventListener(`mousedown`, listener)

	if (origin) {
		origin_addr = id
		listener()
	}

	return nav
}
