import { transformer, write, read, derived } from "/util/store.js"
import { get } from "/sys/wheel.js"
import { tick } from "/sys/time.js"
import { add, minus, divide_scalar, multiply_scalar, multiply, length } from "/util/vector.js"
import { scroll, position } from "/sys/mouse.js"
import { scale } from "/sys/screen.js"
import { down } from "/sys/key.js"

// Which weave is being woven
export const woven = transformer((weave_id) =>
  get(weave_id)
).set(`sys`)

export const hoveree = write(``)
export const draggee = write(``)
export const drag_count = write(0)
draggee.listen(() => drag_count.update($d => $d + 1))

// 50rem between points
const FORCE_PULL = 2
const FORCE_DECAY = 5
const MIN_MOVE = 32
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
  const { threads, knots } = woven.get()
  const $knots = knots.get()
  const $threads = threads.get()
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
      -125 * idx,
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

    const [w, h] = $bodies[id]
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
        [w_o, h + h_o, 0]
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

  // Quad tree eventually
  Object.entries($bodies).forEach(([
    id, [w, h]
  ]) => {
    id = id.split(`/`)[0]
    if (!$knots[id] || $knots[id].knot.get() === `stitch`) return
    if ($hoveree === id) {
      velocities[id] = [0, 0, 0]
      return
    }

    // n^2 sucks until quad tree
    Object.keys($bodies).forEach((o_id) => {
      if (o_id === id) return

      const [[x, y], [o_x, o_y]] = [
        $positions[id],
        $positions[o_id]
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

  if (dirty) positions.set($positions)
})

export const position_scale = derived([
  position,
  scale
], ([$position, $scale]) => [
  $position[0] / $scale,
  $position[1] / $scale,
  0
])

let zoom_val = 1
// take into account scale? No
export const zoom = derived([
  scroll,
  scale
], ([
  $scroll,
  $scale
]) => {
  if (down.get().shift) {
    zoom_val = Math.max(0.25, zoom_val + $scroll[1] / 100)
  }

  return zoom_val * $scale
})

export const zoom_dam = derived(tick, zoom.get)
