<script>
import color from "/action/color.js"
import Spatial from "../Spatial.svelte"
import { position as Mouse } from "/channel/mouse.js"
import { zoom } from "/channel/zoom.js"
import { add } from "/util/vector.js"
import Scaling from "/channel/scaling.js"

export let position = [0, 0]
export let has_name = true
export let hole

$: name = hole.name
$: has_name = hole.type.indexOf("stitch") === -1
let dragging = false

const drag = (e) => {
  if (dragging || e.target.classList.contains(`port`) || e.target.tagName === `INPUT`) {
    return
  }

  dragging = true
  const handler = () => {
    dragging = false
    position = $Mouse
    window.removeEventListener(`mouseup`, handler)
  }

  window.addEventListener(`mouseup`, handler)
}

$: tru_position = add([-50 * $Scaling, -25 * $Scaling], dragging ? $Mouse : position)
$: tru_scale = (dragging ? 1.168 : 1) + $zoom
</script>

<Spatial
  anchor = {[0, 0]}
  position = {tru_position}
  transition = {!dragging}
  scale = {tru_scale}
>
  {#if has_name}
    <div class="nameit" on:mousedown={drag} >
      <div use:color={$name}>
        <input type="text"  class="edit"  bind:value={$name} placeholder="Name It!"/>
      </div>
    </div>
  {/if}

  <div class="hole" on:mousedown={drag}>
    <slot />
  </div>
</Spatial>

<style>
.hole {
  display: flex;
  flex-direction: column;
  background-color: #222;
  border: 0.5rem solid black;
  z-index: 1;
  border-radius: 1rem;
  filter: drop-shadow(1rem 1rem 0 rgba(0,0,0,0.25));
}

.nameit {
  z-index: 2;
  align-self: center;
  background-color: #222;
  border: 0.5rem solid black;
  border-bottom: 0.25rem dashed #333;
  
  margin: 0 2rem;
  margin-bottom: -0.5rem;

  border-radius: 1rem 1rem 0 0;
  overflow: hidden;
  filter: drop-shadow(1rem 0rem 0 rgba(0,0,0,0.25));
}

.edit {
  text-align: center;
  padding: 1rem;
}

.edit:hover {
  background-color: green;
}
</style>