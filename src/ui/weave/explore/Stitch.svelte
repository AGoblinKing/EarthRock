<script>
import { WEAVE_EXPLORE_OPEN } from "/sys/flag.js"
import color from "/ui/action/color.js"
import Channel from "./Channel.svelte"

export let stitch
export let open = $WEAVE_EXPLORE_OPEN

$: name = stitch.name
$: value = stitch.value
$: chans = Object.entries($value)

</script>

<div 
  class="stitch"
  class:open
  on:click={() => open = !open}
  use:color={$name}
>
  {$name}
</div>

{#if open}
<div class="chans">
{#each chans as channel}
  <Channel {channel} />
{/each}
</div>
{/if}

<style>
.stitch {
  padding: 1rem;
  margin-left: 1rem;
  font-size: 0.9rem;
}
.stitch:hover {
  background-color: green !important;
}
</style>