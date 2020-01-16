export const nav_map = {}

export default (node, id) => {
	node.id = id
	nav_map[id] = node

	return {
		destroy: () => {
			delete nav_map[id]
		}
	}
}
