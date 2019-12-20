<script>
import { condense } from "/thread/thread.js"

import SpriteEditor from "/ui/editor/SpriteEditor.svelte"

export let id
export let weave

$: k = weave.get_id(id)
$: type = k.knot

const knot_view = {
  sprite: SpriteEditor
}
</script>

{#if knot_view[$type]}
  <svelte:component this={knot_view[$type]} value={k.value} />
{:else}
  <div class="pad">{condense(id, weave)}</div>
{/if}

<style>
.pad {
  padding: 0.5rem;
}
</style>