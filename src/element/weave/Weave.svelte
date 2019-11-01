<script>
import { get } from "svelte/store"

import Weave from "../../weave/type/weave.js"
import Threads from "./Threads.svelte"
import Picker from "./Picker.svelte"
import Node from "./Node.svelte"

import stitch from "./Stitch.svelte"
import value from "./Value.svelte"
import name from "./Name.svelte"

const weave = Weave()
const nodes = $weave.nodes

const node_types = { stitch, value, name }

const get_type = (node) => {
  const split = get(node).type.split(` `)

  let type

  while ((type = split.pop())) {
    if (node_types[type]) return node_types[type]
  }

  return false
}
</script>

<Picker {weave} />
<Threads {weave} />

{#each Object.entries($nodes) as [_, node]} 
  <Node 
    {node}
    position={[window.innerWidth / 2, window.innerHeight / 2]}
    has_name={get(node).type !== ` name`}
  >
    <svelte:component this={get_type(node)} {node} /> 
  </Node>
{/each}
