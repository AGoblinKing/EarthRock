<script>
import * as Wheel from "/sys/wheel.js"
import { woven, zoom_dam as zoom, translate } from "/sys/weave.js"
import { scroll } from "/sys/mouse.js"
import { tick } from "/sys/time.js"

import { Basic } from "/prefab/weaves.js"

import MainScreen from "./MainScreen.svelte"
import Controls from "./Controls.svelte"
import Threads from "./Threads.svelte"
import Picker from "./Picker.svelte"
import Knot from "./Knot.svelte"
import Explor from "./Explore.svelte"

import { random } from "/util/text.js"
import * as knot_kinds from "./spawnable.js"

const { basic: weave } = Wheel.spawn({
  basic: Basic()
})

woven.set(weave.name.get())

const knots = weave.knots

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
<Explor {weave} />

<div 
  class="knots"
  style={
    [
      `transform:`,
      `scale(${Math.round($zoom * 100)/100})`,
      `translate(${$translate[0]}px, ${$translate[1]}px)`,
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
  width: 100%;
  height: 100%;
  left: -50%;
  top: -50%;
  z-index: 6;
  transition: transform 100ms linear;
}

</style>
