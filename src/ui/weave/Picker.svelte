<script>
import { onDestroy } from "svelte"

import { get } from "/util/store.js"
import * as knots from "/weave/knots.js"
import { scale as Scaling} from "/channel/screen.js"
import { match } from "/channel/port-connection.js"
import color from "/ui/action/color.js"

import Knot_Factory from "/weave/knot.js"

import Knot from "./Knot.svelte"

export let weave

const knot = Knot_Factory()

let picking = false

const pick = (e) => {
  position = [e.x, e.y + 40 * $Scaling]
  picking = true
}

const nopick = () => {
  picking = false
}

const create = (kind) => 
  weave.knots.update((nodes) => {
    const h = Knot_Factory({
      knot: kind
    })

    nodes[get(h.id)] = h

    return nodes
  })


const cancel = match.subscribe((new_match) => {
  if (!new_match) return
  
  weave.give_thread.set(new_match)
})


let position = [0, 0]

$: arr_knots = Object.entries(knots)
</script>
<div 
  class="picker" 
  class:picking 
  on:mousedown={pick}
>
{#if picking}
  <Knot {position} {knot}>
    <div class="prompt">
      <div class="title">
      SPAWN A ...
      </div>
      {#each arr_knots as [kind, fn] (kind)}
        <div class="kind" use:color={kind} on:mouseup={() => create(kind)}>
          {kind}
        </div>
      {/each}
    </div>
  </Knot>
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

.kind:hover {
  background-color: #333;
}
.title {
  padding: 1rem;
}

.kind {
  margin: 0;
  text-transform: uppercase;
  text-align: center;
  padding: 0.5rem;
  filter:drop-shadow(1px 1px 0 black);
  transition: all 250ms cubic-bezier(0.075, 0.82, 0.165, 1);
}

.kind:hover {
  filter: brightness(1.5);
}

</style>