import { write, read, derived, transformer } from "/util/store.js"

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
      knot: `mail`
    },
    stream: {
      knot: `stream`
    },
    math: {
      knot: `math`,
      math: `[v[0]/10, v[1]/10]`
    },
    stitch: {
      name: `player`,
      knot: `stitch`,
      value: {
        position: [0, 0]
      }
    },
    screen: {
      knot: `screen`
    },
    main: {
      knot: `mail`,
      whom: `/sys/screen/main`
    }
  },

  threads = {
    mail: `stream`,
    stream: `math`,
    math: `stitch/position`,
    screen: `main`
  }
} = false) => {
  let threads_set

  const w = {
    id: read(id),
    knot: read(`weave`),

    name: write(name),

    threads: read(threads, set => {
      threads_set = set
    }),

    lives: write([]),
    mails: write({}),
    give_thread: write(),
    give_knot: transformer((knot) => {
      const k = Knot(knot)

      w.knots.update((knots) => ({
        ...knots,
        [k.id]: k
      }))

      return k
    })
  }

  const life_set = w.lives.set

  w.lives.set = undefined
  const life_add = (life) => life_set([
    ...w.lives.get(),
    life
  ])

  w.add = (properties) => {
    const k = Knot({
      ...properties,
      weave: w,
      life: life_add
    })

    w.knots.update(($knots) => ({
      ...$knots,
      [k.id.get()]: k
    }))
  }

  w.knots = write(Object
    .entries(knots)
    .reduce((res, [knot_id, val]) => {
      if (val.id !== knot_id) {
        val.id = knot_id
      }

      res[knot_id] = Knot({
        ...val,
        weave: w,
        life: life_add
      })

      return res
    }, {})
  )

  // index by name, uniqueness not guaranteed
  // Stitches only right now
  w.names = derived(w.knots, ($knots) => Object.fromEntries(
    Object.values($knots)
      .filter(({ knot }) => knot.get() === `stitch`)
      .map(
        (knot) => [
          knot.name.get(),
          knot
        ]
      )
  ))

  w.give_thread.subscribe((match) => {
    if (!match) return

    const [[
      x_id,
      x_dir
    ], [
      y_id,
      y_dir
    ]] = match.map((address) => address.split(`|`))

    if (x_dir === y_dir) {
      console.warn(`Tried to match same direction`)
      return
    }

    const target = [x_id, y_id]
    x_dir === `write` && target.reverse()

    const threads = w.threads.get()

    threads[target[0]] = target[1]
    threads_set(threads)
  })

  return w
}
