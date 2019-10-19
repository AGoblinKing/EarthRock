<script>
import { onMount } from "svelte"
import Card from "./Card.svelte"

export let cards = []
export let position = [0, 0]
export let invert = false
export let scale = 1

let flip = true

onMount(() => {
    setTimeout(() => {
        flip = false
    }, 1000)
})

</script>

{#each cards as card, index (card.id)}
    <Card 
        {...card} 
        {scale}
        position = {[index * 75 * scale - cards.length/2 * 75 * scale + position[0], position[1] + (invert ? -1 : 1) * Math.abs((index - cards.length/2))]}
        rotation = {(index - cards.length/2) * 2 * (invert ? -1 : 1) + (invert ? 180 : 0)}
    />
{/each}

