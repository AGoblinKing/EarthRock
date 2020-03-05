import { read } from "/store.js"

import sprite_frag from "./shader/sprite.frag"
import sprite_vert from "./shader/sprite.vert"

export const sprite = read([
	sprite_vert,
	sprite_frag
])
