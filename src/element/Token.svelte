<script>
import Tile from "./Tiles.svelte"
// Have a king graphic for player token

export let king = false
export let data = ""
export let color = 0

$: grid = king ? [3, 5] : [5, 5]

$: style = `filter:sepia(1) hue-rotate(${color}deg);`

</script>

<div class="token" class:king {style}>
    <Tile width={grid[0]} height={grid[1]} {data} />
</div>


<style>
.token {
    display: flex;
    border-radius: 1rem;
    width: 2rem;
    overflow:hidden;
    height: 2rem;
    border: 0.168rem inset black;
    transition: all 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.token.king {
    width: 3rem; 
    height: 4rem;
}

</style>
