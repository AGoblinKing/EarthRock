import { Store } from 'src/store'
import is from 'src/client/is'

window.addEventListener(`contextmenu`, e => {
	e.preventDefault()
	return false
})

export type INavableResolver = () => string

export interface INavable {
	id: string
	origin?: boolean
	up?: INavableResolver
	left?: INavableResolver
	down?: INavableResolver
	right?: INavableResolver
	page_down?: INavableResolver
	page_up?: INavableResolver
	insert?: INavableResolver
	del?: INavableResolver
	keyboard?: INavableResolver
	home?: INavableResolver
	click?: INavableResolver
	focus?: INavableResolver
	blur?: INavableResolver
}

const buttons = is.sys.query('input', 'buttons')
const tick = is.sys.query('time', 'tick')

export interface IButtonDef {
	repeat?: boolean
	fn?: () => string
	alias?: string
}

export const cursor = new Store<any>(undefined)
export const nav_map = {}
export const goto = (key: string) => {
	if (!nav_map[key]) return

	cursor.set(nav_map[key])
}

let last_node: INavable
let origin_addr: string

const BUTTONS = {
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
} as { [name: string]: IButtonDef }

let last_button = {}
tick.listen(() => {
	if (!last_node) return

	const $button = buttons.get()

	let dest
	Object.entries(BUTTONS).forEach(([key, { repeat, fn, alias }]) => {
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
	if (target === null) return
	cursor.set(target)
})

const current = $node => {
	if (last_node) {
		if (last_node instanceof Element) last_node.classList.remove(`nav`)
		last_node.blur && last_node.blur()
		last_node = undefined
	}

	if (!$node) return

	last_node = $node
	$node.focus && $node.focus()

	if ($node instanceof Element) $node.classList.add(`nav`)
}

cursor.listen(current)

export const nav = (node, opts: INavable) => {
	const { id, origin = false } = opts
	node.id = id

	const navigation = {
		update: (navable: INavable) => {
			Object.assign(node, navable)
		},
		destroy: () => {
			node.removeEventListener(`mousedown`, listener)
			delete nav_map[id]
		}
	}

	navigation.update(opts)

	nav_map[id] = node

	const listener = (e: any = false) => {
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
		cursor.set(node)
	}

	return navigation
}
