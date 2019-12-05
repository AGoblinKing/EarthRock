<script>
import { WEAVE_EXPLORE_OPEN } from "/sys/flag.js"
import color from "/ui/action/color.js"
import Channel from "./Channel.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let filter = []
export let stitch
export let open = $WEAVE_EXPLORE_OPEN
export let weave

$: w_name = weave.name
$: name = stitch.name
$: value = stitch.value
$: chans = Object.entries($value)
</script>

<div 
  class="stitch"
  class:open
  on:click={() => { open = !open }}
  use:color={$name}
>
  <div class="postage">
    <Postage address={`/${$w_name}/${$name}`}/>
  </div>
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
.postage {
  width: 2rem;
  height: 2rem;
  display: flex;
  margin-right: 1rem;
}

.stitch {
  display: flex;
  align-items: center;
  padding: 1rem;
  margin-left: 1rem;
  font-size: 0.9rem;
  border: 0.25rem solid #111;
  border-right: none;
}
.stitch:hover {
  background-color: green !important;
}
</style>