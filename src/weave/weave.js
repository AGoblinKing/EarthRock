import { write, get, read, derived } from "/util/store.js"

import { random } from "/util/text.js"

import Knot from "./knot.js"
import uuid from "cuid"

// Weave of holes connected with threads
export default ({
  name = random(2),
  id = uuid(),

  // just some default nodes for start
  knots = {
    mail: {
      knot: `math`
    }
  },

  threads = {}
} = false) => {
  let threads_set

  const w = {
    id: read(id),
    knot: read(`weave`),

    name: write(name),

    threads: read(threads, set => {
      threads_set = set
    }),

    // index by name, uniqueness not guaranteed
    names: derived(knots, ($knots) => Object.fromEntries(
      Object.values($knots)
        .map(
          (knot) => [get(knot.name), knot]
        )
    )),

    // okay this important so you can clean up bad wires
    give_thread: write(),
    take_thread: write()
  }

  w.knots = write(Object
    .entries(knots)
    .reduce((res, [knot_id, val]) => {
      if (val.id !== knot_id) {
        val.id = knot_id
        console.warn(`Mismatch on IDs ${val.id} vs ${knot_id}`)
      }

      res[knot_id] = Knot({
        ...val,
        weave: w
      })

      return res
    }, {})
  )

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
