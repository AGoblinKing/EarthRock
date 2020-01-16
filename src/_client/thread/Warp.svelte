<script>
import { read } from "/store.js"
import { condense } from "/weave/thread.js"

import ColorEditor from "/_client/editor/ColorEditor.svelte"
import SpriteEditor from "/_client/editor/SpriteEditor.svelte"

export let id
export let weave

$: k = weave.get_id(id)
$: type = (k && k.type) || read(`unknown`)

const warp_view = {
	sprite: SpriteEditor,
	color: ColorEditor
}
</script>

{#if warp_view[$type]}
  <svelte:component this={warp_view[$type]} value={k.value} />
{:else}
  <div data:type={$type} class="pad">{condense(id, weave)}</div>
{/if}

<style>
.pad {
  padding: 0.5rem;
}
</style>