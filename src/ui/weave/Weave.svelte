<script>
import Weave from "/weave/weave.js"
import Threads from "./Threads.svelte"
import Picker from "./Picker.svelte"
import Knot from "./Knot.svelte"
import { get } from "/util/store.js"
import * as knot_kinds from "./spawnable.js"

const weave = Weave()
const knots = weave.knots

const get_ui = (knot) => {
  const ui = knot_kinds[get(knot.knot)]

  return ui === undefined 
    ? knot_kinds.unknown 
    : ui
}
</script>

<Picker {weave} />
<Threads {weave} />

{#each Object.values($knots) as knot} 
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
