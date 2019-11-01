<script>
import Spatial from "../Spatial.svelte"
import { position as Mouse } from "/channel/mouse.js"
import { zoom } from "/channel/zoom.js"
import Scaling from "/channel/scaling.js"
import { readable } from "svelte/store"
import Port from './Port.svelte'

export let position = [0, 0]
export let has_name = true
export let node = readable()

const multiply = (...arrs) => arrs.reduce((result, arr) => {
  arr.forEach((val, i) => {
    if (i > result.length - 1) {
      result.push(val)
    }

    result[i] *= val
  })
  return result
}, [])

const add = (...arrs) => arrs.reduce((result, arr) => {
  arr.forEach((val, i) => {
    if (i > result.length - 1) {
      result.push(val)
    }

    result[i] += val
  })
  return result
}, [])

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
    <div class="port">
      <Port name address={$node.id} />
    </div>
  {/if}

  <div class="node" on:mousedown={drag}>
    <slot />
  </div>
</Spatial>

<style>
.node {
  color: white;
  display: flex;
  flex-direction: column;
  background-color: #222;
  border: 0.5rem inset black;
  z-index: 1;
  border-radius: 1rem;
  filter: drop-shadow(1rem 1rem 0 rgba(0,0,0,0.25));
}

.port {
  position: relative;
  border-radius: 1rem 1rem 0 0;
  align-self: center;
  justify-self: center;
  padding: 0.5rem 1rem;
  background-color: #222;
  border: 0.5rem inset black;
  border-bottom: none;
  margin-bottom: -1px;
  z-index: 2;
}
</style>