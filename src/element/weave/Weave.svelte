<script>
import Weave from "/weave/weave.js"
import Threads from "./Threads.svelte"
import Picker from "./Picker.svelte"
import Hole from "./Hole.svelte"
import * as holes_types from "./spawnable.js"

const weave = Weave()
const holes = weave.holes

const get_type = (node) => {
  const split = node.type.slice(1).split(` `)

  let type

  while ((type = split.pop())) {
    if (holes_types[type]) return holes_types[type]
  }

  return false
}
</script>

<Picker {weave} />
<Threads {weave} />

{#each Object.entries($holes) as [id, hole]} 
  <Hole 
    {hole}
    position={[window.innerWidth / 2, window.innerHeight / 2]}
  >
    <svelte:component this={get_type(hole)} {hole} /> 
  </Hole>
{/each}

<style>
:global(input:hover::placeholder, input:focus::placeholder) {
  color: black;
}

:global(input:hover), :global(input:focus) {
background-color: green !important;
}
</style>
