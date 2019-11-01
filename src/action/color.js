import { color } from "/util/text.js"
import Color from "color"

export default (node, txt_init) => {
  const handler = {
    update: (txt) => {
      let col = Color(color(txt))
      if (col.isDark()) col = col.whiten(0.5)

      // node.style.color = col.toString()
      node.style.backgroundColor = col.negate().fade(0.5).toString()
    }
  }

  handler.update(txt_init)
  return handler
}
