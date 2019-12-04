<script>
import { WEAVE_EXPLORE_OPEN } from "/sys/flag.js"

import color from "/ui/action/color.js"
import Stitch from "./Stitch.svelte"

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
  on:click={() => open = !open}
>
  {$name}
</div>

{#if open}
  <div class="stitches">
    {#each stitches as stitch}
      <Stitch {stitch} />
    {/each}
  </div>
{/if}

<style>
.weave {
  padding: 1rem;
  border-bottom: 0.25rem solid #333;
}
.weave:hover {
  background-color: green !important;
}

</style>
