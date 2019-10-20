<script>
import { onMount } from "svelte"
import Card from "./Card.svelte"

export let cards = []
export let position = [0, 0]
export let invert = false
export let scale = 1
export let spread = 16.18
export let spread_y = 2
export let interact = true
export let rotate = 16.18
export let color = 90
export let onclick = () => {}
export let young = true
export let flip = true

onMount(() => {
    setTimeout(() => {
        young = false
        if(!interact){
            return
        }
        flip = false
    }, 2000)
})
$: x_factor = (cards.length / 30)
$: tru_spread = spread / x_factor
$: tru_rotate = rotate * x_factor
</script>


{#each cards as card, index (card.id)}
    <Card 
        {...card} 
        {scale}
        {invert}
        {interact}
        {color}
        flip={card.flip ? card.flip : flip}
        {onclick}
        position = {
            (card.position && young ?  card.position : 
            [
                index * tru_spread * scale - cards.length/2 * tru_spread * scale + position[0], 
                position[1] + (invert ? -1 : 1) * Math.abs((index - cards.length/2)) * spread_y
            ]
            )
        }
        rotation = {(index - cards.length/2) * tru_rotate * (invert ? -1 : 1) + (invert ? 180 : 0)}
    />
{/each}
