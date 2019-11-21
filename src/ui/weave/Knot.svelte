<script>
import color from "/ui/action/color.js"
import physics from "/ui/action/physics.js"

import Spatial from "/ui/Spatial.svelte"
import { add , minus } from "/util/vector.js"
import { read } from "/util/store.js"

import { positions, draggee, drag_count, translate} from "/sys/weave.js"
import { position as Mouse } from "/sys/mouse.js"
import { scale as Scaling, size} from "/sys/screen.js"

export let position = [0, 0, 0]
export let knot
export let title = false

$: type = knot.knot
$: id = knot.id

const update = () => 
  positions.set({
    ...positions.get(),
    [knot.id.get()]: position
  })

update()

let dragging = false
let zIndex = 2

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
      $Mouse[0] - $size[0]/2 - $translate[0],
      $Mouse[1] - $size[1]/2 - $translate[1],
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
  [-50 * $Scaling, -25 * $Scaling], 
  dragging ? $Mouse : $positions[knot.id.get()],
  dragging ? [-$size[0]/2, -$size[1]/2] : $translate
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
  <div class="adjust">
    <div 
      class="knot" 
      on:mousedown={drag}
      use:physics={$id}
    >
      {#if title}
      <div class="title">{title}</div>
      {/if}
      <slot />
    </div>
  </div>
</Spatial>

<style>
.adjust {
  transform: translate(-50%, -50%);
}

.title {
  position: relative;
  z-index: 2;
  text-shadow: 1px 1px 0 #222, -1px 1px 0 #222,1px -1px 0 #222,-1px -1px 0 #222;
  color: white;
  margin-top: -2rem;
  margin-bottom: -1rem;
  font-size: 3rem;
}

.knot {
  display: flex;
  flex-direction: column;
  background-color: #222;
  border: 0.5rem solid black;
  z-index: 1;
  border-radius: 1rem;
  filter: drop-shadow(1rem 1rem 0 rgba(0,0,0,0.25));
}
.knot:hover {
  filter: drop-shadow(1rem 1rem 1rem rgba(0, 255, 0, 0.5)) drop-shadow(1rem 1rem 0 rgba(0, 0, 0, 0.5));
}
</style>