import { focus } from "/sys/input.js"

export default (node, addr) => ({
  cancel: focus.listen(($focus) => {
    if ($focus !== addr) return
    node.focus()
  })
})
