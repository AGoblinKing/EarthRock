import Weave from "./weave.js"
import { frame } from "/sys/time.js"
import { write, read } from "/util/store.js"
import system from "./system.js"

let feed_set
export const feed = read({
  reader: ``
}, (set) => {
  feed_set = set
})

const SYSTEM = `sys`

let weaves_set
// weaves [name]weave
export const weaves = read({
  [SYSTEM]: system
}, (set) => {
  weaves_set = set
})

const highways = new Map()

let running_set
// run the system weave by default (safe idle)
export const running = read({
  [SYSTEM]: true
}, (set) => { running_set = set })

export const trash = write([])

// put into trash bin
export const del = (path) => {
  if (path[0] === `/`) {
    path.unshift()
  }

  const [weave_name, knot_name, chan] = path.split(`/`)
  if (weave_name === SYSTEM) {
    throw new Error(`attempted to delete ${SYSTEM}`)
  }

  const ws = weaves.get()

  if (knot_name === undefined) {
    const garbo = ws[weave_name]
    delete ws[weave_name]
    weaves.set(ws)

    if (garbo) {
      trash.update(($trash) => [...$trash, garbo])
    }

    return
  }
  const { names, knots } = ws[weave_name]
  const k = names.get()[knot_name]

  if (!k) {
    throw new Error(`tried to delete non-existant path ${path}`)
  }

  if (chan === undefined) {
    const ks = knots.get()
    delete ks[k.id]

    if (k) {
      trash.update(($trash) => [...$trash, k])
    }
    knots.set(ks)
    return
  }

  const chans = k.value.get()
  const garbo = chans[chan]
  delete chans[chan]

  garbo && trash.update(($trash) => [...$trash, garbo])
  k.value.set(chans)
}

// return back whether this thing exists
export const exists = (path) => {
  if (path[0] === `/`) {
    path.unshift()
  }

  const [weave_name, knot_name, chan] = path.split(`/`)
  const w = weaves.get()[weave_name]
  if (w === undefined || knot_name === undefined) {
    return w !== undefined
  }

  const k = w.names.get()[knot_name]
  if (k === undefined || chan === undefined) {
    return k !== undefined
  }

  const c = k.value.get()[chan]

  return c !== undefined
}

// always assume they're right
export const get = (path) => {
  if (path[0] === `/`) {
    path = path.slice(1)
  }

  const [weave_name, knot_name, chan] = path.split(`/`)

  let w = weaves.get()[weave_name]
  if (w === undefined) {
    w = Weave({
      name: weave_name
    })

    weaves_set({
      ...weaves.get(),
      [weave_name]: w
    })
  }

  if (knot_name === undefined) {
    return w
  }

  const names = w.names

  let s = names.get()[knot_name]

  if (!s) {
    w.give_knot.set({
      knot: `stitch`,
      name: knot_name
    })

    s = names.get()[knot_name]
  }

  if (chan === undefined) {
    return s
  }

  let c = s.value.get()[chan]
  if (!c) {
    s.value.set({
      ...s.value.get(),
      [chan]: write(`heLLo default value`)
    })

    c = s.value.get()[chan]
  }

  return c
}

export const start = (weave_name) => {
  if (weave_name === SYSTEM) {
    throw new Error(`CaN NoT StArT or StOp /${SYSTEM}`)
  }
  const w = get(weave_name)
  const knots = w.knots.get()

  const by_id = (id) => {
    const [knot_id, knot_chan] = id.split(`/`)
    const knot = knots[knot_id]

    if (knot === undefined) {
      debugger
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
        const w = by_id(writer)

        return r.subscribe(($val) => {
          w.set($val)

          // costly debug thingy,
          // TODO: better way?
          feed_set({
            reader: `${weave_name}/${reader}`,
            writer: `${weave_name}/${writer}`,
            value: $val
          })
        })
      }),
    // frames
    ...w.lives.get().map((cb) => cb()),

    // ramp to/from the bifrost
    ...Object.entries(w.mails.get())
      .map(
        ([
          mail_id,
          address
        ]) => get(address).subscribe((value_new) => {
          knots[mail_id].set(value_new)
          feed_set({
            reader: address,
            writer: `${weave_name}/${mail_id}`,
            value: value_new
          })
        })
      )
  ])

  running_set({
    ...running.get(),
    [weave_name]: true
  })
}

export const stop = (weave_name) => {
  if (weave_name === SYSTEM) {
    throw new Error(`CaN NoT StArT or StOp /${SYSTEM}`)
  }

  const h = highways.get(weave_name)

  const r = running.get()
  delete r[weave_name]

  running.set(r)

  if (h === undefined) {
    throw new Error(`can't stop ${weave_name}`)
  }

  h.forEach((cancel) => cancel())

  highways.delete(weave_name)
}
