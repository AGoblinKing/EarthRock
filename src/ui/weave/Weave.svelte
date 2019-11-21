<script>
import * as Wheel from "/sys/wheel.js"
import { woven } from "/sys/weave.js"
import { scroll } from "/sys/mouse.js"
import { tick } from "/sys/time.js"

import MainScreen from "./MainScreen.svelte"
import Controls from "./Controls.svelte"
import Threads from "./Threads.svelte"
import Picker from "./Picker.svelte"
import Knot from "./Knot.svelte"

import { random } from "/util/text.js"
import * as knot_kinds from "./spawnable.js"

const id = random(2)
const weave = Wheel.get(id)
woven.set(id)

const knots = weave.knots

const titles = {
  "math": "mAtH",
  stream: "sTrEaM",
  screen: "sCrEeN",
  mail: "mAiL",
  stitch: ""
}

const get_title = (knot) => {
  const type = knot.knot.get()
  return titles[type]
}

const get_ui = (knot) => {
  const ui = knot_kinds[knot.knot.get()]

  return ui === undefined 
    ? knot_kinds.unknown 
    : ui
}

</script>

<MainScreen />
<Controls {weave} />
<Picker {weave} />
<Threads {weave} />

<div 
  class="knots"
>
{#each Object.values($knots) as knot (knot.id.get())} 
  <Knot 
    {knot}
    title={get_title(knot)} 
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
  z-index: 5;
  position: absolute;
  width: 100%;
  height: 100%;
}

</style>
