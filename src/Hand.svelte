<script>
import { onMount } from "svelte"
import { writable } from "svelte/store"

import Card from "./Card.svelte"

export let cards = writable([])
export let max = 10
export let position = [0, 0]
export let invert = false
export let scale = 1
export let drag = false
export let spread = 16.18
export let spread_y = 2
export let interact = true
export let count_factor = 30
export let rotate = 16.18
export let color = 90
export let onclick = () => {}
export let back = writable(``)

$: tru_length = ($cards.length > max ? max : $cards.length) 
$: x_factor = ($cards.length / count_factor)
$: tru_spread = spread / x_factor
$: tru_rotate = rotate * x_factor

</script>


{#each $cards as card, index (card.id)}
    {#if index < max}
        <Card 
            {...card} 
            {scale}
            {invert}
            {interact}
            {color}
            {onclick}
            {card}
            {drag}
            back = {$back}
            position = {
                [
                    index * tru_spread * scale - tru_length/2 * tru_spread * scale + position[0], 
                    position[1] + (invert ? -1 : 1) * Math.abs((index - tru_length/2)) * spread_y
                ]

            }
            rotation = {(index - tru_length/2) * tru_rotate * (invert ? -1 : 1) + (invert ? 180 : 0)}
        />
    {/if}
{/each}
