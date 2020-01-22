import { keys } from "/sys/key.js"
import { write } from "/store.js"
import { tick } from "/sys/time.js"

export const nav_map = {}
export const cursor = write(false)

let last_node

tick.listen(() => {
	if (!last_node) return

	const $keys = keys.get()

	let dest
	if ($keys.arrowup) dest = last_node.up
	if ($keys.arrowdown) dest = last_node.down
	if (!dest) return
	const target = nav_map[dest]
	if (!target) return

	// "instant" other option
	target.scrollIntoView({ behavior: `smooth` })
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

// TODO: Handle update?
export default (node, { id, up, down, origin = false }) => {
	node.id = id
	node.up = up
	node.down = down
	nav_map[id] = node

	node.style.transition = `all 400ms ease-in-out`

	const listener = () => {
		cursor.set(node)
	}

	node.addEventListener(`mouseover`, listener)
	if (origin) listener()
	return {
		destroy: () => {
			node.removeEventListener(`mouseover`, listener)
			delete nav_map[id]
		}
	}
}
