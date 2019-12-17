import { color } from "/util/text.js"
import { THEME_BG } from "/sys/flag.js"

import Color from "color"

export default (node, txt_init) => {
  const handler = {
    update: (txt) => {
      const bg = Color(THEME_BG.get())
      const col = Color(color(JSON.stringify(txt)))
        .blend(bg, 0.8)

      // if (col.getLightness() > 0.4) {
      //   col = col.darkenByAmount(0.3).darkenByRatio(0.2)
      // }

      node.style.backgroundColor = col
        .toCSS()
    }
  }

  handler.update(txt_init)
  return handler
}
