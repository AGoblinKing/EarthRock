<script>
import physics from "/ui/action/physics.js"

import Spatial from "/ui/Spatial.svelte"
import { minus, multiply_scalar } from "/util/vector.js"

import {
  zoom,
  scroll
} from "/sys/input.js"

import {
  positions,
  draggee,
  hoveree,
  drag_count
} from "/sys/weave.js"

import { position as Mouse } from "/sys/mouse.js"

export let position = [0, 0, 0]
export let knot

$: type = knot.knot
$: id = knot.id

let dragging = false
let zIndex = 7
let tru_position

const update = () => {
  $positions[knot.id.get()] = position
  positions.set($positions)
}

$: {
  if (dragging) {
    tru_position = multiply_scalar(minus(
      $Mouse,
      $scroll
    ), 1 / $zoom)
  } else {
    tru_position = $positions[$id]
  }
}

update()

const drag = (e) => {
  if (
    dragging ||
    e.target.classList.contains(`no-drag`) ||
    e.target.tagName === `INPUT` ||
    e.target.tagName === `TEXTAREA`
  ) {
    return
  }

  dragging = true
  draggee.set(knot.id.get())

  const handler = () => {
    dragging = false
    position = multiply_scalar([
      $Mouse[0] - $scroll[0],
      $Mouse[1] - $scroll[1],
      0
    ], 1 / $zoom)
    update()
    draggee.set(``)

    zIndex = drag_count.get()
    window.removeEventListener(`mouseup`, handler)
  }

  window.addEventListener(`mouseup`, handler)
}

$: tru_scale = dragging
  ? 1.168
  : 1
</script>

<Spatial
  anchor = {[50, 50]}
  position = {tru_position}
  transition = {!dragging}
  scale = {tru_scale}
  {zIndex}
>
  <div 
    class="adjust" 
    on:mouseover={() => hoveree.set($id)} 
    on:mouseout={() => hoveree.set(``)}
  >
    <div 
      class="knot" 
      on:mousedown={drag}
      use:physics={$id}
    >
      <slot />
    </div>
  </div>
</Spatial>

<style>

.knot {
  display: flex;
  flex-direction: column;
  background-color: #222;
  border: 0.5rem solid black;
  z-index: 1;
  font-size: 0.75rem;
}

.knot:hover {
  filter: drop-shadow(0rem 0rem 1rem rgba(0, 255, 0, 0.5));
}
</style>