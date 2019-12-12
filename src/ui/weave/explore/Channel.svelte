<script>
import Thread from "./Thread.svelte"
import { THEME_BORDER } from "/sys/flag.js"
import color from "/ui/action/color.js"

export let stitch
export let weave
export let channel
export let focus = false
export let executed = () => {}
export let super_open = false
$: [key, value] = channel

$: editing = focus
let val = ``

const execute = () => {
  editing = false

  try {
    value.set(JSON.parse(val))
  } catch (ex) {
    // no boggie
  }
  val = ``
  executed()
}

const focusd = (node) => {
  node.focus()
}
</script>

{#if weave.id.get() !== Wheel.SYSTEM}
  <Thread {channel} {stitch} {weave} {super_open}/>
{/if}

<div 
  class="channel"
  style="border: 0.25rem solid {$THEME_BORDER};"
  use:color={key}
  on:click={() => {
    editing = true
    val = JSON.stringify($value)
  }}
>
{#if !editing}
  <div class="key">
    {key}
  </div>
  <div class="value">
    {JSON.stringify($value)}
  </div>
{:else}
  <input 
    class="edit"
    use:focusd
    type="text"
    bind:value={val}
    placeholder="JSON PLZ"
    on:keydown={({ which }) => {
      if (which !== 13) return

      execute()
    }}
    on:blur={() => {
      execute()
    }}
  />
{/if}
</div>
<style>

.edit {
  padding: 0.5rem;
}

.channel {
  display: flex;
  font-size: 0.75rem;
  overflow: hidden;
  margin-left: 1rem;
  border-top: none !important;
}

.key {
  border-right: 0.25rem solid rgba(0,0, 0,0.5);
  padding: 0.5rem;
}

.value {
  display: flex;
  flex: 1;
  user-select: all;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
}

.channel:hover {
  color: white;
}
</style>