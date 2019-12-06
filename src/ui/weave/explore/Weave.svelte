<script>
import { WEAVE_EXPLORE_OPEN } from "/sys/flag.js"
import { keys } from "/sys/key.js"

import color from "/ui/action/color.js"
import Stitch from "./Stitch.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let filter = []
export let weave
export let open = $WEAVE_EXPLORE_OPEN

$: name = weave.name
$: names = weave.names
$: stitches = Object.values($names)

let super_open = $WEAVE_EXPLORE_OPEN
</script>
<div 
  class="weave"
  class:open
  use:color={$name}
  on:click={() => {
    if ($keys.shift) {
      open = true
      super_open = !super_open
      return
    }

    open = !open
  }}
>
  <div class="postage">
    <Postage 
      address={`/${$name}`} 
    />
  </div>
  {$name}
</div>

{#if open}
  <div class="stitches">
    {#each stitches as stitch}
      {#if 
        filter.length === 0 ||
        stitch.name.get().indexOf(filter[0]) !== -1
      }
        <Stitch 
          {stitch} 
          filter={filter.slice(1)} 
          open={super_open} 
          {weave}
        />
      {/if}
    {/each}
  </div>
{/if}

<style>
.postage {
  width: 3rem;
  height: 3rem;
  display: flex;
  margin-right: 1rem;
}

.weave {
  align-items:center;
  display: flex;
  padding: 1rem;
  border: 0.25rem solid #111;
  border-right: none;
}
.weave:hover {
  background-color: green !important;
}

</style>
