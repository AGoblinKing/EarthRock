<script>
import { THEME_BG } from "/sys/flag.js"

import border from "/ui/action/border.js"
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

$: notstitch = $type !== `stitch`

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
      use:border
      class:notstitch
      on:mousedown={drag}
      use:physics={$id}
      style={`background-color: ${$THEME_BG};`}
    >
  
      <slot />

    </div>
  </div>
</Spatial>

<style>
.noshow {
display: flex;
  flex-direction: column;
  opacity: 0;
}
.knot {
  box-shadow:
    0rem -6rem  rgba(0, 100, 0, 0.7),
    0rem -3rem  rgba(0, 50, 0, 0.7);
  display: flex;
  flex-direction: column;
  font-size: 0.75rem;
}

.notstitch {
  box-shadow:
    -6rem -6rem  rgba(0, 100, 0, 0.7),
    -3rem 3rem  rgba(0, 100, 0, 0.7),
    3rem -3rem  rgba(0, 50, 0, 0.7),
    6rem 6rem  rgba(0, 50, 0, 0.7);
}

.notstitch:hover {
    box-shadow: 
    -6rem -6rem  rgba(0, 100, 0, 0.8),
    -3rem 3rem  rgba(0, 100, 0, 0.8),
    3rem -3rem  rgba(0, 50, 0, 0.8),
    6rem 6rem  rgba(0, 50, 0, 0.8);
}


</style>