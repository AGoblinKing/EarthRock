import { write, read, derived } from "/util/store.js"

import { random } from "/util/text.js"

import Knot from "./knot.js"
import uuid from "cuid"

// Weave of holes connected with threads
export default ({
  name = random(2),
  id = uuid(),
  knots = {},
  threads = {},
  rezed = {}
} = false) => {
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

    threads: write(threads),

    lives: write([]),
    rezed: write(rezed),
    validate: () => {
      let dirty = false
      let deletes = 0
      const t = w.threads.get()
      const ks = w.knots.get()

      Object.values(ks).forEach((k) => {
        if (k.knot.get() === `stitch`) return
        const chain = w.chain(k.id.get(), true)
        const last = chain[chain.length - 1].split(`/`)[0]
        const first = chain[0].split(`/`)[0]
        const k_last = ks[last]
        const k_first = ks[first]
        if ((k_last && k_last.knot.get() === `stitch`) ||
          (k_first && k_first.knot.get() === `stitch`)
        ) return
        delete ks[k.id.get()]
        deletes += 1
      })
      if (deletes > 0) {
        console.warn(`Deleted ${deletes} orphans on validation.`)
        w.knots.set(ks)
      }

      Object.entries(t).forEach(([r, w]) => {
        if (exists(r) && exists(w)) return

        dirty = true
        delete (t[r])
      })

      if (!dirty) return

      w.threads.set(t)
    },

    chain: (address, right = false) => {
      const other = right
        ? w.threads.get()[address]
        : w.threads_r.get()[address]

      if (!other) return [address]
      return [...w.chain(other, right), address]
    },

    toJSON: () => {
      const {
        id,
        knot,
        name,
        threads,
        knots,
        rezed
      } = w

      return JSON.parse(JSON.stringify({
        id,
        knot,
        name,
        threads,
        knots,
        rezed
      }))
    }
  }

  const life_set = w.lives.set

  w.lives.set = undefined
  const life_add = (life) => life_set([
    ...w.lives.get(),
    life
  ])

  w.threads_r = read({}, (set) => {
    w.threads.listen(($threads) => {
      set(Object.fromEntries(Object.entries($threads).map(
        (item) => item.reverse()
      )))
    })
  })

  w.get_knot = (id) => w.knots.get()[id]
  w.to_address = (id_path) => {
    const [knot] = id_path.split(`/`)

    const k = w.get_knot(knot)
    if (!k || !k.name) return `/sys/void`

    return `/${w.name.get()}/${k.name.get()}`
  }
  w.remove_name = (name) => {
    const k = w.names.get()[name]
    if (!k) return
    const id = k.id.get()
    return w.remove(id)
  }

  w.remove = (id) => {
    const k = w.knots.get()[id]
    if (!k) return

    const $t = w.threads.get()
    const t_o = $t[id]
    const t_me = w.threads_r.get()[id]
    if (t_o) {
      delete $t[id]
      w.threads.set($t)
    }
    if (t_me) {
      delete $t[t_me]
      w.threads.set($t)
    }
    w.knots.update(($knots) => {
      delete $knots[id]

      return $knots
    })
  }
  w.add = (properties) => {
    const k = Knot({
      ...properties,
      weave: w,
      life: life_add
    })

    w.knots.update(($knots) => {
      $knots[k.id.get()] = k
      return $knots
    })

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

  return w
}
