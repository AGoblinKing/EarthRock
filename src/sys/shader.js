import { read } from "/util/store.js"

import test_frag from "./shader/test.frag"
import test_vert from "./shader/test.vert"
import sprite_frag from "./shader/sprite.frag"
import sprite_vert from "./shader/sprite.vert"

const breaker = (a) => a.map(i => `\r\n${i}`)

export const test = read(breaker([
  test_vert,
  test_frag
]))

export const sprite = read(breaker([
  sprite_vert,
  sprite_frag
]))
