<script>
import Spatial from "../Spatial.svelte"

import { down } from "/sys/key.js"

export let weave

$: name = weave.name
$: running = Wheel.running

$: runs = $running[weave.name.get()]

const toggle = () => {
  if (runs) {
    Wheel.stop($name)
  } else {
    Wheel.start($name)
  }

  runs = !runs
}

$: {
  if ($down === ` `) toggle()
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
  padding: 2rem;
}

.play:hover {
  background-color: #228;
}

.runs {
  color: #282;
  border: 0.25rem solid  black;
  background-color: #111;
}

</style>
