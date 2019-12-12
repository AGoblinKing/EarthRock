import { m4 } from "twgl"
import { write } from "/util/store.js"

const validate = ({ set }) => (val) => {
  if (!Array.isArray(val)) return
  set(val)
}

export const camera = write(m4.identity())
export const position = write([0, 0, 0])
export const look = write([0, 0, -1])

look.set = validate(look)
position.set = validate(position)
