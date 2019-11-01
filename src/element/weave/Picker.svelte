<script>
import { onDestroy } from "svelte"
import { get } from "svelte/store"
import * as types from "../../weave/types.js"
import Scaling from "../../channel/scaling.js"
import Node from "./Node.svelte"
import color from "../action/color.js"
import { match } from "../../channel/port-connection.js"

export let weave

const wires = $weave.wires

let picking = false

const pick = (e) => {
  position = [e.x, e.y + 40 * $Scaling]
  picking = true
}

const nopick = () => {
  picking = false
}

const create = (type) => {
  $weave.nodes.update((nodes) => {
    const node = types[type]()
    nodes[get(node).id] = node

    return nodes
  })
}

onDestroy(match.subscribe((new_match) => {
  if (!new_match) return
  $weave.give_thread.set(new_match)
}))

let position = [0, 0]

$: arr_types = Object.entries(types)
</script>
<div 
  class="picker" 
  class:picking 
  on:mousedown={pick}
>
{#if picking}
  <Node {position} has_name={false}>
    <div class="prompt">
      <div class="title">
      SPAWN A ...
      </div>
      {#each arr_types as [type, fn] (type)}
        {#if type !== `node`}
        <div class="type" use:color={type} on:mouseup={() => create(type)}>
          {type}
        </div>
        {/if}
      {/each}
    </div>
  </Node>
{/if}
</div>

<svelte:window on:mouseup={nopick} />

<style>
.picker {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  transition: all 250ms cubic-bezier(0.075, 0.82, 0.165, 1);
}

.picking {
  z-index: 1001;
  background-color: rgba(0, 0, 0, 0.25)
}

.type:hover {
  background-color: #333;
}
.title {
  padding: 1rem;
}

.type {
  margin: 0;
  text-transform: uppercase;
  text-align: center;
  padding: 0.5rem;
  filter:drop-shadow(1px 1px 0 black);
  transition: all 250ms cubic-bezier(0.075, 0.82, 0.165, 1);
}

.type:hover {
  filter: brightness(1.5);
}

</style>