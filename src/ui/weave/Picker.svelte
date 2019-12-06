<script>
import { positions } from "/sys/weave.js"
import { scroll } from "/sys/input.js"
import * as knots from "/weave/knots.js"
import { scale, size } from "/sys/screen.js"
import { match, del } from "/sys/port-connection.js"
import color from "/ui/action/color.js"

import Knot_Factory from "/weave/knot.js"

import Knot from "./Knot.svelte"

export let weave

const knot = Knot_Factory()

let position = [0, 0, 0]
let picking = false

const pick = (e) => {
  position = [
    e.x - $size[0] / 2 - 5 * $scale,
    e.y - $size[1] / 2 - 1 * $scale,
    0
  ]

  picking = true
}

const nopick = () => {
  picking = false
}

const create = (k) => {
  const knot_new = weave.add({
    knot: k
  })
  const i = knot_new.id.get()
  const ps = positions.get()
  ps[i] = [...position]
  console.log(i, ps[i])
  positions.set(ps)
}

const cancel = () => cancels.forEach(fn => fn())

const cancels = [
  match.subscribe((new_match) => {
    if (!new_match) return

    weave.give_thread.set(new_match)
  }),

  del.subscribe((port) => {
    if (!port) return
    const [id, type] = port.split(`|`)
    if (type === `write`) return

    weave.take_thread.set(id)
  })
]

$: arr_knots = Object.entries(knots)
</script>

<div 
  class="picker" 
  class:picking 
  on:mousedown={pick}
>

{#if picking}
  <Knot {position} {knot}>
    <div class="prompt">
      <div class="title">
      SPAWN A ...
      </div>
      {#each arr_knots as [kind, fn] (kind)}
        <div class="kind" use:color={kind} on:mouseup={() => create(kind)}>
          {kind}
        </div>
      {/each}
    </div>
  </Knot>
{/if}
</div>

<svelte:window on:mouseup={nopick} />

<style>
.picker {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 6;
  width: 100%;
  height: 100%;
  transition: all 250ms cubic-bezier(0.075, 0.82, 0.165, 1);
}

.picking {
  z-index: 1001;
  background-color: rgba(0, 0, 0, 0.25)
}

.kind:hover {
  background-color: #333;
}
.title {
  padding: 1rem;
  color: rgb(224, 168, 83);
}

.kind {
  color: rgb(224, 168, 83);
  margin: 0;
  text-transform: uppercase;
  text-align: center;
  padding: 0.5rem;
  /* transition: all 250ms cubic-bezier(0.075, 0.82, 0.165, 1); */
}

.kind:hover {
  filter: invert(1);
}

</style>