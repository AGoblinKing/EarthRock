<script>
import { size } from "/sys/screen.js"
import { woven } from "/sys/weave.js"

import { scroll, zoom } from "/sys/input.js"

import MainScreen from "./MainScreen.svelte"
import Controls from "./Controls.svelte"
import Threads from "./Threads.svelte"
import Picker from "./Picker.svelte"
import Knot from "./Knot.svelte"
import Explore from "./Explore.svelte"

import * as knot_kinds from "./spawnable.js"

// Reset Scroll
scroll.set([
  $size[0] / 4, $size[1] / 4, 0
])

zoom.set(0.50)

$: knots = $woven.knots
$: weave = $woven

const get_ui = (knot) => {
  const ui = knot_kinds[knot.knot.get()]

  return ui === undefined
    ? knot_kinds.unknown
    : ui
}
</script>

<MainScreen />
<Controls {weave} />

<Threads {weave} />
<Picker {weave} />
<Explore />

<div 
  class="knots"
  style={
    [
      `transform:`,
      `translate3d(${$scroll[0]}px, ${$scroll[1]}px, 0)`,
      `scale(${$zoom})`,
      `;`
    ].join(` `) 
  }
>

{#each Object.values($knots) as knot (knot.id.get())} 
  <Knot 
    {knot}
  >
    <svelte:component this={get_ui(knot)} {knot} /> 
  </Knot>
{/each}
</div>
<style>
:global(input:hover::placeholder, input:focus::placeholder, textarea:hover::placeholder, textarea:focus::placeholder) {
  color: black;
}

:global(input:hover, input:focus, textarea:hover, textarea:focus){
  background-color: green !important;
}

.knots {
  position: absolute;
  z-index: 6;
  transition: transform 100ms linear;
}

</style>
