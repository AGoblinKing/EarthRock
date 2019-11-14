<script>
import { onMount } from 'svelte'
import Tile from '../../image/tile.js'

export let data = ""
export let width = 10
export let height = 7
export let random = false

let image_src = Tile({
    width, 
    height, 
    data,
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