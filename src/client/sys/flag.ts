import { Store, Read} from "src/store"

import Color from "color-js"

export const SPRITES = new Store(`/sheets/default_2.png`)
export const SPRITES_COLOR = new Store(`/sheets/default_2_color.png`)
export const IS_DEV = new Store(false)

export const SVELTE_ANIMATION = new Store({ delay: 100, duration: 300 })

export const TILE_COUNT = new Store(1024)
export const TILE_COLUMNS = new Store(32)

export const THEME_COLOR = new Store(`rgb(224, 168, 83)`)
export const THEME_BG = new Store(`#033`)
export const THEME_GLOW = new Store(`green`)

export const CURSOR = new Store(`/`)

export const THEME_BORDER = new Store(``, $value => Color($value)
	.darkenByRatio(0.5)
	.toCSS()
)

export const THEME_STYLE = new Read(``, set => {
	let $THEME_BORDER = ``

	const update = () => set([
		`border: 0.2rem solid ${$THEME_BORDER};`
	].join(``))

	THEME_BORDER.listen($val => {
		$THEME_BORDER = $val
		update()
	})
})
