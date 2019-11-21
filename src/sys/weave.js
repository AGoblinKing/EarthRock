import { transformer, write, read } from "/util/store.js"
import { get } from "/sys/wheel.js"
import { tick } from "/sys/time.js"
import { add, minus, divide_scalar, multiply_scalar, distance } from "/util/vector.js"
import { scale } from "/sys/screen.js"
import { scroll } from "/sys/mouse.js"

// Which weave is being woven
export const woven = transformer((weave_id) =>
  get(weave_id)
).set(`sys`)

export const draggee = write(``)
export const drag_count = write(0)
draggee.listen(() => drag_count.update($d => $d + 1))

// 50rem between points
const STRENGTH = 0.25
const FRICTION = 50
const MIN_MOVE = 5
const MIN_DISTANCE = 150

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

const pull_right = [350, 100, 0]

tick.listen(() => {
  const { threads, knots } = woven.get()
  const $knots = knots.get()
  const $threads = threads.get()
  const $positions = positions.get()

  let dirty = false
  const pos = (id) => $positions[id] || [0, 0, 0]

  // attempt to pull threads together
  Object.entries($threads).forEach(([
    puller,
    pullee
  ]) => {
    pullee = pullee.split(`/`)[0]
    puller = puller.split(`/`)[0]
    const pos_er = pos(puller)
    const pos_ee = pos([pullee])

    const pull = multiply_scalar(pull_right, scale.get())

    velocities[pullee] = add(
      divide_scalar(vel(pullee), FRICTION),

      // difference of distance
      multiply_scalar(
        add(minus(pos_er, pos_ee), pull),
        STRENGTH
      )
    )

    velocities[puller] = add(
      divide_scalar(vel(puller), FRICTION),

      // difference of distance
      multiply_scalar(
        minus(minus(pos_ee, pos_er), pull),
        STRENGTH
      )
    )
  })

  // Repulse collisions
  const $bodies = bodies.get()

  // Quad tree eventually
  Object.entries($bodies).forEach(([
    id, [w, h]
  ]) => {
    id = id.split(`/`)[0]
    if (!$knots[id] || $knots[id].knot.get() === `stitch`) return

    const p = pos(id)

    Object.keys($bodies).forEach((o_id) => {
      if (o_id === id) return

      const dist = distance(p, pos(o_id))
      if (dist > MIN_DISTANCE) return

      // move it
      const v = vel(id)
      velocities[id] = add(
        v,
        multiply_scalar(
          minus(p, pos(o_id)),
          (MIN_DISTANCE - dist) * 0.01
        )
      )
    })

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
