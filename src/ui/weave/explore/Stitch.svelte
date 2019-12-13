<script>
import color from "/ui/action/color.js"
import { WEAVE_EXPLORE_OPEN, THEME_STYLE } from "/sys/flag.js"
import { keys } from "/sys/key.js"

import Omni from "./Omni.svelte"
import Channel from "./Channel.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let filter = []
export let stitch
export let open = $WEAVE_EXPLORE_OPEN
export let weave

export let super_open = $WEAVE_EXPLORE_OPEN

$: w_name = weave.name
$: name = stitch.name
$: rezed = weave.rezed
$: value = stitch.value
$: chans = Object.entries($value).sort(([a], [b]) => {
  if (a > b) return 1
  if (b > a) return -1
  return 0
})

let omni_focus = false

let focus = ``

const executed = () => {
  omni_focus = true
}

const command = ([
  action,
  chan = ``
]) => {
  chan = chan.trim()
  switch (action) {
    case `+`:
      value.add({ [chan]: `` })
      focus = chan
      return
    case `-`:
      value.remove(chan)
      weave.chain(`${stitch.id.get()}/${chan}`).forEach((id) => {
        weave.remove(id)
      })
  }
}

const toggle = (e) => {
  e.preventDefault()
  e.stopPropagation()
  const r = $rezed
  if (r[stitch.id.get()]) {
    delete r[stitch.id.get()]
  } else {
    r[stitch.id.get()] = true
  }
  rezed.set(r)
}
</script>

<div 
  class="stitch"
  class:open
  use:color={$name}
  on:click={() => {
    if ($keys.shift) {
      super_open = !super_open
      return
    }
    open = !open
  }}
  style="{$THEME_STYLE}"
>
  <div class="postage" on:click={toggle}>
    <Postage address={`/${$w_name}/${$name}`}/>
  </div>
  {$name}
</div>

{#if open}
<div class="chans">

{#if $w_name !== Wheel.SYSTEM}
  <Omni {command} focus={omni_focus} />
{/if}

{#each chans as channel}
  {#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}
    <Channel 
      {channel} 
      {stitch} 
      {weave} 
      {super_open}
      {executed}
    />
  {/if}
{/each}
</div>
{/if}

<style>

.chans {
  margin-left: 1rem;
}

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
  border-right: none;
  margin-top:-0.25rem;
}
.stitch:hover {
  color: white;
}
</style>