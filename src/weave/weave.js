import { writable, get, readable } from "svelte/store"

import * as Types from "./types.js"
import Hole from "./type/hole.js"
import { random } from "/util/text.js"

export default ({
  // just some default nodes for start
  holes = {
    // guarantees the key and id will be the same
    example: {
      name: `example`,
      type: ` stitch`,
      value: {
        [random(1)]: random(2),
        [random(1)]: random(2)
      }
    }
  },
  type = ``,
  threads = {},
  name = `\\/\\/eave ${random(2)}`,
  ...junk
} = false) => {
  let threads_set

  const w = Hole({
    ...junk,
    name,
    holes: writable(Object
      .entries(holes)
      .reduce((res, [hole_name, val]) => {
        const type = val.type.slice(1).split(` `).pop()

        if (!Types[type]) return console.error(`!UnKoWn TyPe> ${type} - ${name}|${name}`)
        res[hole_name] = Types[type](val)
        return res
      }, {})
    ),
    type: `${type} weave`,
    threads: readable(threads, set => {
      threads_set = set
    }),
    // okay this important so you can clean up bad wires
    give_thread: writable(),
    take_thread: writable()
  })

  w.give_thread.subscribe((match) => {
    if (!match) return

    const [x, y] = match

    const [x_name, y_name] = [x.split(`|`).length === 1, y.split(`|`).length === 1]

    const is_name = x_name || y_name

    // red to blue not samies
    if (!is_name && x.slice(-1) === y.slice(-1)) return
    if (is_name && x[0] === `/` && y[0] === `/`) return
    const threads = get(w.threads)

    // clean up
    if (threads[x]) {
      delete threads[threads[x]]
    }

    if (threads[y]) {
      delete threads[threads[y]]
    }

    threads[x] = y
    threads[y] = x

    threads_set(threads)
  })

  return w
}
