import { transformer, write } from "/util/store.js"
import { tick } from "/sys/time.js"
import { path } from "/sys/path.js"
import { loaded } from "/sys/data.js"
import { size } from "/sys/screen.js"
import { scroll, zoom } from "/sys/input.js"

import {
  add,
  minus,
  divide_scalar,
  multiply_scalar,
  multiply
} from "/util/vector.js"

// Which weave is being woven
export const woven = transformer((weave_id) => {
  const w = Wheel.get(weave_id)
  if (!w) return woven.get()

  return w
}).set(`sys`)

Wheel.trash.listen((trashee) => {
  if (!trashee) return

  if (woven.get().name.get() === trashee.name.get()) {
    woven.set(`sys`)
  }
})

export const hoveree = write(``)
export const draggee = write(``)
export const drag_count = write(0)
draggee.listen(() => drag_count.update($d => $d + 1))

// 50rem between points
const FORCE_PULL = 2
const FORCE_DECAY = 5
const MIN_MOVE = 40
const FORCE_STRONG = 1.25

export const bodies = write({})
// keeps all the postions for woven
export const positions = write({})
let velocities = {}

// reset positions
woven.listen(() => {
  positions.set({})
  velocities = {}
  drag_count.set(0)
})

const vel = (id) => velocities[id] || [0, 0, 0]

tick.listen((t) => {
  const { threads, knots, names } = woven.get()
  const $knots = knots.get()
  const $threads = threads.get()
  const $names = names.get()
  const $positions = positions.get()
  const $bodies = bodies.get()

  const $hoveree = hoveree.get()

  let dirty = false
  const stitch = (id) => $knots[id].knot.get() === `stitch`

  const pos = (id) => $positions[id] || [0, 0, 0]
  const dest_count = {}
  const chan_depth = (id, chan) => {
    const $v = $knots[id].value.get()

    if (!$v) return [0, 0, 0]
    const idx = Object.keys($v).indexOf(chan)

    return [
      25 + (idx % 2) * 161.8,
      -150 * idx,
      0
    ]
  }

  // attempt to pull threads together
  Object.entries($threads).forEach(([
    address,
    address_o
  ]) => {
    const [id_o, chan_o] = address_o.split(`/`)
    const [id, chan] = address.split(`/`)

    // keep track of destinations
    dest_count[id_o] = dest_count[id_o]
      ? dest_count[id_o] + 1
      : 1

    if (!$bodies[id] || !$bodies[id_o]) return

    let [w, h] = $bodies[id]

    h = stitch(id)
      ? 0
      : h / 2

    const [w_o, h_o] = $bodies[id_o]
    // woho my friend

    // factor in size
    const pos_me = add(
      pos(id),
      [w + 16.18, h + 10, 0],
      chan_o === undefined
        ? multiply_scalar([
          0,
          h + 10,
          0
        ], dest_count[id_o] - 1)
        : chan_depth(id_o, chan_o)
    )

    let pos_other = add(
      pos(id_o),
      chan === undefined
        ? [0, 0, 0]
        : add(
          multiply(
            chan_depth(id, chan),
            [-1, 1, 0]
          ),
          [0, h / 1.5, 0]
        )
    )

    // stitch nipple
    if (stitch(id) && chan === undefined) {
      pos_other = add(
        pos_other,
        [w_o, h + h_o + 100, 0]
      )
    }

    // moving to top left, don't need to worry about our own dims
    velocities[id] = add(
      vel(id),
      // difference of distance
      multiply_scalar(
        add(
          minus(
            pos_other,
            pos_me
          )
        ),
        FORCE_PULL
      )
    )

    velocities[id_o] = add(
      vel(id_o),
      // difference of distance
      multiply_scalar(
        add(
          minus(
            pos_me,
            pos_other
          )
        ),
        FORCE_PULL
      )
    )
  })

  const bodies_dirty = false
  // Quad tree eventually
  Object.entries($bodies).forEach(([
    id, [w, h]
  ]) => {
    id = id.split(`/`)[0]
    // don't move nonexistant things
    if (!$knots[id]) {
      // delete $bodies[id]
      // bodies_dirty = true
      return
    }

    const k = $knots[id]

    // don't apply velocities to stitches
    if (k.knot.get() === `stitch`) {
      return
    }

    // stop hover from moving
    if ($hoveree === id) {
      velocities[id] = [0, 0, 0]
      return
    }

    // n^2 sucks until quad tree
    Object.keys($bodies).forEach((o_id) => {
      if (o_id === id) return

      const [pos_id, pos_oid] = [
        $positions[id],
        $positions[o_id]
      ]
      if (!pos_id || !pos_oid) return

      const [[x, y], [o_x, o_y]] = [
        pos_id,
        pos_oid
      ]

      const [[w, h], [o_w, o_h]] = [
        $bodies[id],
        $bodies[o_id]
      ]

      // AABB
      if (
        x < o_x + o_w &&
        x + w > o_x &&
        y < o_y + o_h &&
        y + h > o_y
      ) {
        // move it
        const v = vel(id)

        // push directly away but
        // keep velocity so it can maybe go through
        velocities[id] = add(
          v,
          multiply_scalar(
            [x - o_x, y - o_y, 0],
            FORCE_STRONG
          )
        )
      }
    })

    // Decay the velocity
    velocities[id] = divide_scalar(vel(id), FORCE_DECAY)

    // simple length tests to modify velocity
    const [v_x, v_y] = vel(id)
    if (Math.abs(v_x) + Math.abs(v_y) < MIN_MOVE) return
    if (id === draggee.get()) return

    dirty = true
    $positions[id] = add(
      pos(id),
      vel(id)
    )
  })
  if (bodies_dirty) bodies.set($bodies)

  let height = 0

  Object.values($names).forEach((k) => {
    const id = k.id.get()
    const y = 1 + height
    if (pos(id)[1] !== y) {
      dirty = true
      $positions[id] = [
        0,
        y,
        0
      ]
    }
    const $body = $bodies[id]
    const offset = $body === undefined
      ? 100
      : $body[1]

    height += 300 + offset
  })

  if (dirty) positions.set($positions)
})

let tm

let last_focus
path.listen(async ($path) => {
  if (
    $path[0] !== `weave` ||
    $path.length === 1
  ) return

  await loaded
  if (!Wheel.get($path[1])) {
    path.set(`weave`)
    return
  }

  woven.set($path[1])

  const [w, h] = size.get()
  scroll.set([w / 3, 0, 0])

  const $names = woven.get().names.get()
  const keys = Object.keys($names)
  const k_id = $path[2] || keys[keys.length - 1]
  const knot = $names[k_id]

  if (tm) clearTimeout(tm)
  tm = setTimeout(() => {
    tm = false
    const $positions = positions.get()
    const $bodies = bodies.get()
    const $id = knot.id.get()
    last_focus = $id
    const pos = $positions[$id]
    const bod = $bodies[$id]
    if (!pos) return

    scroll.set([
      w / 3,
      -(pos[1] + bod[1]) * zoom.get() + h - 20,
      0
    ])
  }, 100)
})

zoom.listen(() => {
  if (!last_focus) return
  const [w, h] = size.get()
  const $positions = positions.get()
  const $bodies = bodies.get()
  const $id = last_focus

  const pos = $positions[$id]
  const bod = $bodies[$id]
  if (!pos) return

  scroll.set([
    w / 3,
    -(pos[1] + bod[1]) * zoom.get() + h - 20,
    0
  ])
})
