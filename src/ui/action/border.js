import { THEME_BORDER } from "/sys/flag.js"

export default (node, size = 0.5) => ({
  destroy: THEME_BORDER.listen(($border) => {
    node.style.border = `${size}rem solid ${$border}`
  })
})
