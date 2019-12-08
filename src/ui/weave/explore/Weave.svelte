<script>
import { woven } from "/sys/weave.js"
import { WEAVE_EXPLORE_OPEN, THEME_BG } from "/sys/flag.js"
import { keys } from "/sys/key.js"

import border from "/ui/action/border.js"

import Stitch from "./Stitch.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let filter = []
export let weave
export let open = $WEAVE_EXPLORE_OPEN

$: name = weave.name
$: names = weave.names
$: stitches = Object.values($names)

let super_open = $WEAVE_EXPLORE_OPEN

$: active = $woven.name.get() === $name
</script>
<div 
  class="weave"
  class:open
  style="background-color: {$THEME_BG}"
  use:border
  class:active
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

.active {
  background-color: rgb(25, 66, 25) !important;
}
.weave {
  align-items:center;
  display: flex;
  padding: 1rem;
  border-right: none;
}
.weave:hover {
  background-color: green !important;
}

</style>
