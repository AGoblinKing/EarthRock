<script>
import { read } from "/store.js"
import { condense } from "/weave/thread.js"

import ColorEditor from "/_client/editor/ColorEditor.svelte"
import SpriteEditor from "/_client/editor/SpriteEditor.svelte"

export let id
export let weave

$: k = weave.get_id(id)
$: value = (k && k.value) || read(`unknown`)
$: type = (k && k.type) || read(`unknown`)

const warp_view = {
	sprite: SpriteEditor,
	color: ColorEditor
}

let changed = false
const change = (node, value) => {
	let timeout
	return {
		destroy: value.listen(() => {
			if (timeout) clearTimeout(timeout)

			changed = true
			setTimeout(() => {
				changed = false
			}, 250)
		})
	}
}

$: condensed = condense(id, weave, $value)
</script>

<div
	class="warp"
	class:changed
	use:change={value}
>
	{#if warp_view[$type]}
		<svelte:component this={warp_view[$type]} value={k.value} />
	{:else}
		<div data:type={$type} class="pad">{condensed}</div>
	{/if}
</div>

<style>
.warp {
	transition: box-shadow 250ms ease-in-out;
}

.changed {
	box-shadow: inset 0 100% 0 rgba(0,0,0,0.25),
}

.pad {
  padding: 0.5rem;
}
</style>