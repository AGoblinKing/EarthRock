<script>

// import Tile from "../image/Tile.svelte"

// import { zoom } from "/sys/input.js"

import Explore from "/ui/weave/Explore.svelte"
</script>


<Explore />

<!-- <div class="background" style="opacity: {$zoom * 0.02 + 0.01}">
    <Tile random width={25} height={25}/>
</div> -->

<style>
.background {
  display: flex;
  z-index: 0;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  position: absolute;
  filter: sepia(1) hue-rotate(-90deg);
  transition: opacity 100ms linear;
  opacity: 0.01;
  pointer-events: none;
}
</style>