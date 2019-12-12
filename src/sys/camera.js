import { m4 } from "twgl"
import { write } from "/util/store.js"

const up = [0, 1, 0]

export const camera = write(m4.identity())
export const position = write([0, 0, 0])
export const look = write([0, 0, -1])

const update = () => {
  const c = camera.get()

  m4.lookAt(position.get(), look.get(), up, c)

  camera.set(c)
}

look.listen(update)
position.listen(update)
