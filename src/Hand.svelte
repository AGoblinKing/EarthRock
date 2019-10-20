<script>
import { onMount } from "svelte"
import Card from "./Card.svelte"

export let cards = []
export let position = [0, 0]
export let invert = false
export let scale = 1
export let spread = 75
export let spread_y = 1
export let interact = true
export let rotate = 2
export let color = 90

let flip = true

onMount(() => {
    if(!interact){
        return
    }

    setTimeout(() => {
        flip = false
    }, 1000)
})

</script>

{#each cards as card, index (card.id)}
    <Card 
        {...card} 
        {scale}
        {invert}
        {interact}
        {color}
        {flip}
        position = {[index * spread * scale - cards.length/2 * spread * scale + position[0], position[1] + (invert ? -1 : 1) * Math.abs((index - cards.length/2)) * spread_y]}
        rotation = {(index - cards.length/2) * rotate * (invert ? -1 : 1) + (invert ? 180 : 0)}
    />
{/each}

