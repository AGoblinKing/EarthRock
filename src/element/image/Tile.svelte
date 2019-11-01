<script>
import { onMount } from 'svelte'
import Tile from '../../image/tile.js'

export let data = ""
export let width = 10
export let height = 7
export let spacing = 0
export let random = false

let image;

onMount(async () => {
    image.src = await Tile({
        width, 
        height, 
        data,
        random
    })
})

</script>

<img
    class="tileset" 
    alt="tileset image"
    bind:this={image}
/>

<style>
.tileset {
    flex: 1;
    max-width: 100%;
    pointer-events: none;
}

</style>