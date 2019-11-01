<script>
import { onMount, createEventDispatcher } from "svelte"
import { writable } from "svelte/store"
import scaling from "../scaling.js"
import Card from "./Card.svelte"

const dispatch = createEventDispatcher()

export let cards = writable([])
export let max = 10
export let position = [0, 0]
export let anchor = [50, 50]
export let invert = false
export let fade = false
export let drag = false
export let reverse = false
export let scale = 1
export let spread = 10
export let spread_y = 1
export let interact = true
export let rotate = 3
export let rotation = 0
export let color = 90
export let back = writable(``)

$: tru_length = ($cards.length > max ? max : $cards.length) 
$: x_factor = Math.max(tru_length / max, 0.5) 
$: tru_spread = spread / x_factor * $scaling
$: tru_rotate = rotate / x_factor

const tru_index = (index) => reverse ? $cards.length - index : index;

</script>


{#each $cards as card, index (card.id)}
    {#if tru_index(index) < max}
        <Card 
            {...card} 
            scale={scale * $scaling}
            {invert}
            {interact}
            {color}
            {card}
            {drag}
            {fade}
            {anchor}
            on:dragstart = {({detail}) => dispatch('dragstart', detail)}
            on:dragend = {({ detail }) => dispatch('dragend', detail)}
            on:click = {({ detail }) => dispatch('click', detail)}

            back = {$back}
            position = {
                Math.abs(rotation) === 90
                ?
                 [
                    position[0], 
                    position[1] + tru_index(index) * tru_spread - tru_length/2 * tru_spread
                 ]
                : [
                    position[0] + tru_index(index) * tru_spread - tru_length/2 * tru_spread, 
                    position[1] +  (invert ? -1 : 1) * Math.abs((tru_index(index) - tru_length/2)) * spread_y
                ]

            }
            rotation = {rotation + (tru_index(index) - tru_length/2) * tru_rotate * (invert ? -1 : 1) + (invert ? 180 : 0)}
        />
    {/if}
{/each}
