import Weave from "./weave.js"
import { write, read } from "/util/store.js"

export const SYSTEM = `sys`

let feed_set
export const feed = read({}, (set) => {
  feed_set = set
})

export const feed_add = (address) => {
  const $f = feed.get()
  $f[address] = Date.now()
  feed_set($f)
}

// weaves [name]weave
export const weaves = write({
  [SYSTEM]: Weave({
    name: SYSTEM,
    id: SYSTEM
  })
})

const highways = new Map()

let running_set
// run the system weave by default (safe idle)
export const running = read({
  [SYSTEM]: true
}, (set) => { running_set = set })

export const trash = write()

const addr = (address) => {
  let path = address.split(`/`)
  if (path[0] === ``) path = path.slice(1)
  return path
}

// put into trash bin
export const del = (keys) => {
  const $running = running.get()
  const $weaves = weaves.get()

  let dirty = false

  Object.keys(keys).forEach((key) => {
    if (key === SYSTEM) return

    if ($running[key]) {
      stop(key)
    }

    if ($weaves[key]) {
      dirty = true

      trash.set(
        $weaves[key]
      )

      delete $weaves[key]
    }
  })

  if (dirty) weaves.set($weaves)
}

export const get = (address) => {
  const [
    weave_name,
    knot_name,
    chan
  ] = addr(address)

  const w = weaves.get()[weave_name]
  if (w === undefined) return
  if (knot_name === undefined) return w

  const k = w.names.get()[knot_name]
  if (k === undefined) return
  if (chan === undefined) return k

  const c = k.value.get()[chan]
  if (c === undefined) return

  return c
}

export const exists = (address) => get(address) !== undefined

// create the whole path if you gotta
export const spawn = (pattern = {}) => Object.fromEntries(
  Object.entries(pattern).map(([
    weave_id,
    weave_data
  ]) => {
    if (weave_id === SYSTEM) {
      console.warn(`tried to spawn ${SYSTEM}`)
      return [weave_id, get(weave_id)]
    }

    const ws = weaves.get()
    const w = Weave({
      ...weave_data,
      name: weave_id
    })

    ws[weave_id] = w

    weaves.set(ws)
    return [weave_id, w]
  })
)

export const start = (weave_name) => {
  if (weave_name === SYSTEM) {
    throw new Error(`CaN NoT StArT or StOp /${SYSTEM}`)
  }
  const w = get(weave_name)
  if (!w) return false

  const knots = w.knots.get()

  const by_id = (id) => {
    const [knot_id, knot_chan] = id.split(`/`)
    const knot = knots[knot_id]

    if (knot === undefined) {
      console.warn(`knot  undefined`)
      return
    }

    if (knot_chan === undefined) {
      return knot.value
    }

    return knot.value.get()[knot_chan]
  }

  // this could be reactive
  highways.set(weave_name, [
    // the internal streets
    ...Object.entries(w.threads.get())
      .map(([
        reader,
        writer
      ]) => {
        const r = by_id(reader)
        const wr = by_id(writer)
        if (!wr || !r) {
          w.threads.update(($t) => {
            delete $t[reader]
            return $t
          })
          return () => {}
        }

        return r.subscribe(($val) => {
          wr.set($val)

          // costly debug thingy,
          // TODO: better way?

          const $f = feed.get()
          $f[`${weave_name}/${reader}`] = Date.now()
          $f[`${weave_name}/${writer}`] = Date.now()

          feed_set($f)
        })
      }),
    // lives
    ...w.lives.get().map((cb) => cb())
  ])

  running_set({
    ...running.get(),
    [weave_name]: true
  })

  return true
}

export const stop = (weave_name) => {
  if (weave_name === SYSTEM) {
    console.warn(`CaN NoT StArT or StOp /${SYSTEM}`)
  }

  const h = highways.get(weave_name)

  const r = running.get()
  delete r[weave_name]

  running_set(r)

  if (h === undefined) {
    return
  }

  h.forEach((cancel) => cancel())

  highways.delete(weave_name)
}

export const restart = (name) => {
  Wheel.stop(name)
  Wheel.start(name)
}

const bump = (what) => JSON.parse(JSON.stringify(what))

export const toJSON = () => ({
  weaves: bump(weaves),
  running: bump(running)
})

export const REG_ID = /\$?[~\.]?\/[a-zA-Z \/]+/g
