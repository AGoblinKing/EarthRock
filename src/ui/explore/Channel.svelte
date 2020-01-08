<script>
import SpriteEditor from "/ui/editor/SpriteEditor.svelte"
import ColorEditor from "/ui/editor/ColorEditor.svelte"

import Thread from "./Thread.svelte"
import { THEME_STYLE } from "/sys/flag.js"
import { json } from "/util/parse.js"

import color from "/ui/action/color.js"

export let space
export let nothread
export let weave
export let channel
export let side = `in`
export let focus = false
export let executed = () => {}

$: [key, value] = channel

$: edit = $value
$: editing = focus
let val = ``

const execute = () => {
	editing = false

	try {
		value.set(json(val))
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

<div
  class="channel {side}"
  style={$THEME_STYLE}
  use:color={space.name().get()}
  on:click={() => {
    editing = true
    val = JSON.stringify($value)
  }}
>

<Thread {channel} {space} {weave} {nothread}/>

{#if !editing}
  <div class="key">
    {key}
  </div>

  {#if key === `sprite`}
    <SpriteEditor {value} />
	{:else if key === `color`}
	<ColorEditor {value} />
  {:else}
  <div class="value">
    {
     JSON.stringify(edit)
    }
    </div>
  {/if}
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
  border-right: 0.25rem solid rgba(0,0, 0,0.5);
}

.value {
  display: flex;
  flex: 1;
  max-height: 1rem;
  user-select: all;
  padding: 0.5rem;
  overflow: hidden;
  word-break: break-all;
  text-align: left;
}

.channel:hover {
  color: white;
}

</style>