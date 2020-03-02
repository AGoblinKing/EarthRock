<script>
import { tile } from "/text.js"

import Tile from '/_client/image/tile.js'

export let data = ``
export let width = 10
export let height = 7
export let random = false
export let text = false

$: tru_data = text
	? tile(text)
	: data

$: image_src = Tile({
	width,
	height,
	data: tru_data,
	random
})
</script>

{#await image_src then src }
<img
    class="tileset"
    alt="tileset image"
    {src}
/>
{/await}
<style>
.tileset {
    flex: 1;
    max-width: 100%;
    pointer-events: none;
}
</style>