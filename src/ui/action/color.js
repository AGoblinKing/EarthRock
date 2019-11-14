import { color } from "/util/text.js"
import Color from "color"

const whiten = (color, amount) => {
  color.blue += amount
  color.red += amount
  color.green += amount

  return color
}

const negate = (color) => {
  color.red = 1 - color.red
  color.green = 1 - color.green
  color.blue = 1 - color.blue
  return color
}

export default (node, txt_init) => {
  const handler = {
    update: (txt) => {
      let col = Color(color(JSON.stringify(txt)))
      if (col.getLuminance() < 0.5) col = whiten(col, 0.5)

      // node.style.color = col.toString()
      negate(col)
      col.alpha = 0.5
      node.style.backgroundColor = col.toCSS()
    }
  }

  handler.update(txt_init)
  return handler
}
