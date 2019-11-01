import { color } from "../../util/text.js"
import Color from "color"

export default (node, txt_init) => {
  const handler = {
    update: (txt) => {
      node.style.color = color(txt)
      node.style.backgroundColor = Color(node.style.color).negate().fade(0.5).toString()
    }
  }

  handler.update(txt_init)
  return handler
}
