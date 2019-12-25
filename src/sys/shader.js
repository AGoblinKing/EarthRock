import { read } from "/util/store.js"

import sprite_frag from "./shader/sprite.frag"
import sprite_vert from "./shader/sprite.vert"

const breaker = (a) => a.map(i => `\r\n${i}`)

export const sprite = read(breaker([
	sprite_vert,
	sprite_frag
]))
