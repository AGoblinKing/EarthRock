import { focus } from "../../sys/input"

export default (node, addr) => ({
	destroy: focus.listen(($focus) => {
		if ($focus !== addr) return
		node.focus()
	})
})
