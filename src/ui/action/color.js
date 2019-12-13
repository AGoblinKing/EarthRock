import { color } from "/util/text.js"
import Color from "color"

export default (node, txt_init) => {
  const handler = {
    update: (txt) => {
      const col = Color(color(JSON.stringify(txt)))

      node.style.backgroundColor = col.darkenByRatio(0.75).setAlpha(0.75).toCSS()
    }
  }

  handler.update(txt_init)
  return handler
}
