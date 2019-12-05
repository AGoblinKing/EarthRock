<script>
import { path } from "/sys/path.js"
import { running } from "/sys/wheel.js"

import Tile from "/ui/image/Tile.svelte"
export let address = ``

const punch_it = (e) => {
  e.preventDefault()
  path.set(`weave${address}`)
  return false
}

$: active = $running[address.split(`/`)[1]] === true
</script>

<div 
  class="postage no-drag"
  on:click={punch_it}
  class:active
>
  <Tile width={1} height={1} random />
</div>

<style>
.postage {
  flex: 1;
  display: flex;
  background-color: #111;
  filter: sepia(1) hue-rotate(180deg)    
    drop-shadow(-0.25rem 0.25rem 0 black)
    drop-shadow(0.25rem -0.25rem 0 black);

  padding: 0.25rem;
  border: 0.25rem solid  #333;
}
.postage:hover {
  background-color: green;
}

.postage.active {
  filter: sepia(1) hue-rotate(90deg) 
    drop-shadow(-0.25rem 0.25rem 0 black)
    drop-shadow(0.25rem -0.25rem 0 black)
    drop-shadow(0 0 1rem green);
}
</style>