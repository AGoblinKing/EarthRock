import { transformer, write, read } from "/util/store.js"
import { get } from "/sys/wheel.js"
import { tick } from "/sys/time.js"
import { add, minus, divide_scalar, multiply_scalar } from "/util/vector.js"
import { scroll } from "/sys/mouse.js"
import { scale } from "/sys/screen.js"

// Which weave is being woven
export const woven = transformer((weave_id) =>
  get(weave_id)
).set(`sys`)

export const draggee = write(``)
export const drag_count = write(0)
draggee.listen(() => drag_count.update($d => $d + 1))

// 50rem between points
const FORCE_PULL = 1.5
const FORCE_FRICTION = 5
const MIN_MOVE = 5
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
  const $scale = scale.get()

  let dirty = false
  const pos = (id) => $positions[id] || [0, 0, 0]

  // attempt to pull threads together
  Object.entries($threads).forEach(([
    puller,
    pullee
  ]) => {
    pullee = pullee.split(`/`)[0]
    puller = puller.split(`/`)[0]

    if (!$bodies[puller] || !$bodies[pullee]) return

    const [w, h] = $bodies[puller]

    // factor in size
    const pos_er = add(
      pos(puller),
      [w + 10 , h + 10, 0]
    )

    
    const pos_ee = pos(pullee)
    
    // moving to top left, don't need to worry about our own dims
    velocities[puller] = add(
      vel(puller),
      // difference of distance
      multiply_scalar(
        add(
          minus(
            pos_ee,
            pos_er
          )
        ),
        FORCE_PULL
      )
    )

    velocities[pullee] = add(
      vel(pullee),
      // difference of distance
      multiply_scalar(
        add(
          minus(
            pos_er,
            pos_ee
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
    velocities[id] = divide_scalar(vel(id), FORCE_FRICTION)

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

// TODO: These will hang around reactive statement?
const translate_velocity = write([0, 0, 0])
export const translate = read(translate_velocity.get(), (set) =>
  tick.listen(() => {
    const t = translate_velocity.get()
    const p = translate.get()

    set([
      t[0] + p[0],
      t[1] + p[1],
      0
    ])
    translate_velocity.set([0, 0, 0])
  })
)

scroll.listen(([x, y]) =>
  translate_velocity.update(([t_x, t_y]) => [t_x + x, t_y + y, 0])
)
