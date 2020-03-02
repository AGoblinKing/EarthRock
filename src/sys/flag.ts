import { write, read } from "store"
import Color from "color-js"

export const TIME_TICK_RATE = write(100)

export const SPRITES = read(`/sheets/default_2.png`)
export const SPRITES_COLOR = read(`/sheets/default_2_color.png`)
export const IS_DEV = read(window.location.host === `localhost:5000`)

export const SVELTE_ANIMATION = write({ delay: 100, duration: 300 })

export const TILE_COUNT = read(1024)
export const TILE_COLUMNS = read(32)

export const THEME_COLOR = write(`rgb(224, 168, 83)`)
export const THEME_BG = write(`#033`)
export const THEME_GLOW = write(`green`)

export const CURSOR = write(`/`)

export const THEME_BORDER = read(``, (set) =>
	THEME_BG.listen(($THEME_BG) => set(Color($THEME_BG)
		.darkenByRatio(0.5)
		.toCSS()
	))
)
export const THEME_STYLE = read(``, (set) => {
	let $THEME_BORDER = ``

	const update = () => set([
		`border: 0.2rem solid ${$THEME_BORDER};`
	].join(``))

	THEME_BORDER.listen(($val) => {
		$THEME_BORDER = $val
		update()
	})
})
