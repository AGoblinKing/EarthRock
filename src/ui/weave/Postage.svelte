<script>
import { path } from "/sys/path.js"
import { woven } from "/sys/weave.js"

import Tile from "/ui/image/Tile.svelte"
export let address = ``
export let nopunch = false

$: runnings = Wheel.running
$: weave = address.split(`/`)[1]
$: running = $runnings[weave] === true
$: active = $woven.name.get() === weave

const punch_it = (e) => {
  e.stopPropagation()
  e.preventDefault()

  if (nopunch) return

  path.set(`weave${address}`)
  return true
}
</script>

<div 
  class="postage no-drag"
  on:click={punch_it}
  class:active
  class:running
>
  <Tile 
    width={1} 
    height={1} 
    text={address}
  />
</div>

<style>
.postage {
  flex: 1;
  display: flex;
  background-color: #111;
  filter: sepia(1) hue-rotate(-50deg)    
    drop-shadow(-0.25rem 0.25rem 0 black)
    drop-shadow(0.25rem -0.25rem 0 black);

  padding: 0.25rem;
  border: 0.25rem solid  #333;
}
.postage:hover {
  background-color: green;
}
.postage:active {
  background-color: black;
  filter: sepia(1) hue-rotate(180deg)    
    drop-shadow(0.25rem 0.25rem 0 black)
    drop-shadow(-0.25rem -0.25rem 0 black);
}

.postage.running {
  filter: sepia(1) hue-rotate(90deg) 
    drop-shadow(-0.25rem 0.25rem 0 black)
    drop-shadow(0.25rem -0.25rem 0 black);
}
.postage.running:active {
  background-color: black;
  filter: sepia(1) hue-rotate(90deg)    
    drop-shadow(0.25rem 0.25rem 0 black)
    drop-shadow(-0.25rem -0.25rem 0 black);
}

</style>