<script>
import color from "/ui/action/color.js"
import physics from "/ui/action/physics.js"

import Spatial from "/ui/Spatial.svelte"
import { add , minus, multiply_scalar } from "/util/vector.js"
import { read } from "/util/store.js"

import { 
  positions, 
  draggee, 
  hoveree, 
  drag_count, 
  translate,
  position_scale as Mouse 
} from "/sys/weave.js"

export let position = [0, 0, 0]
export let knot

$: type = knot.knot
$: id = knot.id

const update = () => 
  positions.set({
    ...positions.get(),
    [knot.id.get()]: position
  })

update()

let dragging = false
let zIndex = 7

const drag = (e) => {
  if (  
    dragging 
    || e.target.classList.contains(`port`) 
    || e.target.tagName === `INPUT`
    || e.target.tagName === `TEXTAREA`
  ) {
    return
  }

  dragging = true
  draggee.set(knot.id.get())

  const handler = () => {
    dragging = false
    position = [
      $Mouse[0] - $translate[0],
      $Mouse[1] - $translate[1],
      0
    ]
    update()
    draggee.set('')
  
    zIndex = drag_count.get() 
    window.removeEventListener(`mouseup`, handler)
  }

  window.addEventListener(`mouseup`, handler)
}

$: tru_position = add(
  dragging 
    ? minus(
        $Mouse,
        $translate
      )
    : $positions[knot.id.get()],
  
)

$: tru_scale = (dragging ? 1.168 : 1)

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
  filter: drop-shadow(1rem 1rem 0 rgba(0,0,0,0.25));
}

.knot:hover {
  filter: drop-shadow(1rem 1rem 1rem rgba(0, 255, 0, 0.5)) drop-shadow(1rem 1rem 0 rgba(0, 0, 0, 0.5));
}
</style>