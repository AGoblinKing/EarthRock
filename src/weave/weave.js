import { write, read, transformer, derived } from "/util/store.js"

import { random } from "/util/text.js"

import Knot from "./knot.js"
import uuid from "cuid"

// Weave of holes connected with threads
export default ({
  name = random(2),
  id = uuid(),
  knots = {},
  threads = {}
} = false) => {
  let threads_set

  const exists = (id) => {
    const [knot, channel] = id.split(`/`)

    const k = w.knots.get()[knot]
    if (!k) return false
    if (channel === undefined) return true

    return Object.keys(k.value.get()).indexOf(channel) !== -1
  }
  const w = {
    id: read(id),
    knot: read(`weave`),

    name: write(name),

    threads: read(threads, set => {
      threads_set = set
    }),

    lives: write([]),
    mails: write({}),
    take_thread: write(),
    give_thread: write(),
    give_knot: transformer((knot) => {
      const k = Knot(knot)

      w.knots.update((knots) => ({
        ...knots,
        [k.id]: k
      }))

      return k
    }),
    validate: () => {
      let dirty = false
      const t = w.threads.get()
      Object.entries(t).forEach(([r, w]) => {
        if (exists(r) && exists(w)) return

        dirty = true
        delete (t[r])
      })

      if (!dirty) return

      w.threads.set(t)
    },
    toJSON: () => {
      const {
        id,
        knot,
        name,
        threads,
        knots
      } = w

      return JSON.parse(JSON.stringify({
        id,
        knot,
        name,
        threads,
        knots
      }))
    }
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

    return k
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
  w.names = derived(w.knots, ([$knots]) => Object.fromEntries(
    Object.values($knots)
      .filter(({ knot }) => knot.get() === `stitch`)
      .map(
        (knot) => [
          knot.name.get(),
          knot
        ]
      )
  ))

  w.take_thread.subscribe((id) => {
    if (!id) return
    const $threads = w.threads.get()

    if (!$threads[id]) return
    delete $threads[id]

    threads_set($threads)
  })

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

  w.validate()
  return w
}
