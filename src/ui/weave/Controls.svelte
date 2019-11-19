<script>
import Spatial from "../Spatial.svelte"
import { running, stop, start } from "/sys/wheel.js"

export let weave

$: name = weave.name
let runs = $running[$name]

const toggle = () => {
  if(runs) {
    stop($name)
  } else {
    start($name)
  }

  runs = !runs
}
</script>

<div class="bar"></div>

<Spatial
  anchor={[50, 100]}
>
  <div class="play" class:runs on:click={toggle}>
    {#if runs}
      ||
    {:else}
      |>
    {/if}
  </div>
</Spatial>

<style>
.bar {
  position: absolute;
  bottom: 0;
  height: 3rem;
  width: 100%;
  border-top: 0.25rem solid black;
  background-color: #333;
}

.play {
  font-size: 4rem;
  color: white;
  background-color: #222;
  transition: all 250ms linear;
  border: 0.25rem solid black;
  border-radius: 1rem;
  padding: 2rem;
}

.play:hover {
  background-color: #228;
}

.runs {
  color: #282;
  border: 0.25rem dashed black;
}


</style>