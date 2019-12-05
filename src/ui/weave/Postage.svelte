<script>
import { path } from "/sys/path.js"

import Tile from "/ui/image/Tile.svelte"
export let address = ``
</script>

<div 
  class="postage no-drag"
  on:click={() => path.set(`weave${address}`)}
>
  <Tile width={1} height={1} random />
</div>

<style>
.postage {
  flex: 1;
  display: flex;
  background-color: #111;
  filter: sepia(1) hue-rotate(90deg) 
    drop-shadow(-0.25rem 0.25rem 0 black)
    drop-shadow(0.25rem -0.25rem 0 black);
  padding: 0.25rem;
  border: 0.25rem solid  #333;
}
.postage:hover {
  background-color: green;
}
</style>