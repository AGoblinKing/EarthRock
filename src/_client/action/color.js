import { color } from "/text.js"
import { THEME_BG } from "/sys/flag.js"

import Color from "color"

export default (node, txt_init) => {
	const handler = {
		update: (txt) => {
			const bg = Color(THEME_BG.get())
			const col = Color(color(JSON.stringify(txt)))
				.blend(bg, 0.8)

			node.style.backgroundColor = col
				.toCSS()
		}
	}

	handler.update(txt_init)
	return handler
}

export const dark = (node, txt) => {
	const update = () => {
		node.style.backgroundColor = Color(color(JSON.stringify(txt)))
			.blend(Color(THEME_BG.get()), 0.8)
			.darkenByRatio(0.2)
	}

	update()

	return {
		update
	}
}
