<script>
import { WEAVE_EXPLORE_OPEN } from "/sys/flag.js"
import color from "/ui/action/color.js"
import Channel from "./Channel.svelte"

export let filter = []
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
  {#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}
    <Channel {channel} />
  {/if}
{/each}
</div>
{/if}

<style>
.stitch {
  padding: 1rem;
  margin-left: 1rem;
  font-size: 0.9rem;
  border-left: 0.25rem solid #333;
  border-bottom: 0.25rem solid #333;
}
.stitch:hover {
  background-color: green !important;
}
</style>