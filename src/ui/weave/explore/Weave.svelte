<script>
import { WEAVE_EXPLORE_OPEN } from "/sys/flag.js"

import color from "/ui/action/color.js"
import Stitch from "./Stitch.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let filter = []
export let weave
export let open = $WEAVE_EXPLORE_OPEN

$: name = weave.name
$: names = weave.names
$: stitches = Object.values($names)
</script>
<div 
  class="weave"
  class:open
  use:color={$name}
  on:click={() => { open = !open }}
>
  <Postage /> {$name}
</div>

{#if open}
  <div class="stitches">
    {#each stitches as stitch}
      {#if 
        filter.length === 0 ||
        stitch.name.get().indexOf(filter[0]) !== -1
      }
        <Stitch {stitch} filter={filter.slice(1)}/>
      {/if}
    {/each}
  </div>
{/if}

<style>
.weave {
  padding: 1rem;
  border-bottom: 0.25rem solid #111;
  border-top: 0.25rem solid #111;
}
.weave:hover {
  background-color: green !important;
}

</style>
