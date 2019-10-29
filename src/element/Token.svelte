<script>
import Tile from "./Tiles.svelte"
// Have a king graphic for player token

export let king = false
export let data = ""
export let color = 0
export let stats = {}

let hover = false

const mouseOver = () => {
    if(hover) {
        return
    }
    
    hover = true

    setTimeout(() => {
        hover = false
    }, 250)
}

$: grid = king ? [3, 5] : [5, 5]

$: style = `filter:sepia(1) hue-rotate(${color}deg) drop-shadow(0px 0px 1rem rgba(0, 255, 0, 0.2));`
$: stats_arr = Object.entries(stats)

</script>

<div class="text">
    {#each stats_arr as [name, data]}
        <div class="{name}">
            {data}
        </div>
    {/each}
</div>


<div class="token" class:king {style}>
    <Tile width={grid[0]} height={grid[1]} {data} />
</div>
<div class="bg">
<Tile width={grid[1]} height={grid[0]} {data} />
</div>

<style>
.token {
    position: relative;
    z-index: 1;
    background-color: black;
    display: flex;
    width: 5rem;
    overflow:hidden;
    height: 5rem;
    border: 0.1rem solid black;
    transition: all 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.bg {
    position: relative;
    z-index: 0;
    margin-top: -2rem;
    margin-left: -1.2rem;
    width: 5rem;
    height: 3rem;
    background-color: black;
    filter:grayscale(1) brightness(0.25);
    border: 0.1rem solid black;
    overflow: hidden;
    border-radius: 0.5rem;
}
.token.king {
    width: 2.5rem; 

    height: 4rem;
    border-radius: 0.5rem 0.5rem 0 0;
}

.text {
    z-index:1;
    position: absolute;
    margin-top: 5rem;
    font-size: 1rem;
    display: grid;
    width: 4rem;
    grid-template: "a b c 2rem";
      text-shadow:
     1px 1px 0 #000;
}   

.hearts {
    color: red;
    grid-area: a;
}

.gems {
    color: blue;
    grid-area: c;
}

</style>
