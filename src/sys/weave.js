import { derived, transformer } from "/util/store.js"
import { get } from "/sys/wheel.js"

// Which weave is being woven
export const woven = transformer((weave_id) =>
  get(weave_id)
).set(`sys`)

// 50rem between points
const SPACING = 500

// codify this pattern?
// How to turn off the derived nature?
// Think this is same as $: knots = $woven.knots in svelte

const cancels = new Set()
const cancel = () => {
  cancels.forEach((fn) => fn())
  cancels.clear()
}

// Keep a positional spread of the active edited weave
// layout the names vertically
// then pile the threads left/right
// put unassigned knots up top in their own tracks
export const spread = derived(
  woven,
  ({
    names,
    threads
  }) => {
    const $names = names.get()
    const $threads = threads.get()
    const positions = {}

    // any previous cancelables
    cancel()

    let max_y = 0
    // these are all the weaves
    Object.values($names).forEach((knot, i) => {
      const $id = knot.id.get()
      positions[$id] = [0, i * SPACING]

      // rip through the channels to give them positions
      // update these in real time?
      cancels.add(knot.value.subscribe(($chans) => {
        Object.keys($chans).forEach((name, chan_i) => {
          positions[`${$id}/${name}`] = [0, i * SPACING + chan_i * SPACING / 10]
        })
      }))

      max_y++
    })

    const follow = (id) => {
      if (positions[id]) return positions[id]

      const pos = (() => {
        if ($threads[id]) {
          const [f_x, f_y] = follow($threads[id])
          return [
            f_x - SPACING,
            f_y
          ]
        }

        // welp you must be a leaf
        max_y++
        return [
          0,
          max_y * SPACING
        ]
      })()

      positions[id] = pos

      return pos
    }

    // follow all threads
    Object.keys($threads).forEach(follow)
    console.log(positions)
    return positions
  })
