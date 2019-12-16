<script>
import Thread from "./Thread.svelte"
import { THEME_BORDER } from "/sys/flag.js"
import color from "/ui/action/color.js"
import { tick } from "/sys/time.js"
export let stitch
export let weave
export let channel
export let side = `in`
export let focus = false
export let executed = () => {}
export let super_open = false
$: [key, value] = channel

let display = null

$: editing = focus
let val = ``

// avoid massive updates
const update = (t) => {
  if (t % 2 !== 0 || display === value.get()) return
  display = value.get()
}

$: {
  update($tick)
}

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
  <Thread {channel} {stitch} {weave} {super_open} {side} />
{/if}

<div
  class="channel {side}"
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
    {JSON.stringify(display)}
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
  width: 100%;
}

.channel {
  display: flex;
  font-size: 0.75rem;
  overflow: hidden;
  margin-left: 1rem;
  border-top: none !important;
}

.channel.out {
  margin-left: 0;
  margin-right: 1rem;
  flex-direction: row-reverse;
}

.key {
  border-right: 0.25rem solid rgba(0,0, 0,0.5);
  padding: 0.5rem;
}

.out .key {
  border-right: none;
  border-left: 0.25rem solid rgba(0,0, 0,0.5);
}

.value {
  display: flex;
  flex: 1;
  user-select: all;
  padding: 0.5rem;
  overflow: hidden;
  height: 0.75rem;
  text-align: left;
}

.channel:hover {
  color: white;
}
</style>