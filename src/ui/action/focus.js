import { focus } from "/sys/input.js"

export default (node, addr) => ({
	destroy: focus.listen(($focus) => {
		if ($focus !== addr) return
		node.focus()
	})
})
