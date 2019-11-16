<script>
import * as Wheel from "/weave/wheel.js"

import Controls from "./Controls.svelte"
import Threads from "./Threads.svelte"
import Picker from "./Picker.svelte"
import Knot from "./Knot.svelte"
import { random } from "/util/text.js"
import * as knot_kinds from "./spawnable.js"

const weave = Wheel.get(random(2))
const knots = weave.knots

const get_ui = (knot) => {
  const ui = knot_kinds[knot.knot.get()]

  return ui === undefined 
    ? knot_kinds.unknown 
    : ui
}
</script>

<Controls {weave} />
<Picker {weave} />
<Threads {weave} />

{#each Object.values($knots) as knot (knot.id.get())} 
  <Knot 
    {knot}
    position={[window.innerWidth / 2, window.innerHeight / 2]}
  >
    <svelte:component this={get_ui(knot)} {knot} /> 
  </Knot>
{/each}

<style>
:global(input:hover::placeholder, input:focus::placeholder) {
  color: black;
}

:global(input:hover), :global(input:focus) {
background-color: green !important;
}
</style>
