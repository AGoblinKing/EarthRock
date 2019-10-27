<script>
import {writable} from "svelte/store"
import { fade, fly} from 'svelte/transition'
import scaling from "../scaling.js"
import tick from "../tick.js"
import Spatial from "./Spatial.svelte"
import game from "../game.js"
import Hand from "./Hand.svelte"
import Gem from "./Gem.svelte"
import Heart from "./Heart.svelte"
import Token from "./Token.svelte"
import {Grid, Circle} from "../curves.js"

const {home_gems, home_hearts, home_tokens} = game.state

$: arr_home_gems = Array.from(Array(9)).map((_,i) => ({
    empty: i < $home_gems
}))

$: arr_home_hearts = Array.from(Array(6)).map((_,i) => ({
    empty: i < $home_hearts
}))


const scale = 0.25;

const deck = {
	scale,
    spread: 0,
    max: 4,
    reverse: true,
    interact: false,
}
const circle = Circle({
    max: 32, 
    radius: 75
})
const circle_heart = Circle({
    max: 6, 
    radius: 15
})
const play_home = writable([])
const play_away = writable([])

const discard = {
    scale,
    spread: 5,
    spread_y: 0,
    rotate: 0,
    rotation: 90,
    fade: true,
    drag: true,
    max: 10
}

game.server_fake()

</script>

<div class="game" out:fly={{delay: 100, duration:1000, x: 0, y: 1000, opacity: 0}}>

<!-- Home Hands -->
<Hand 
	cards = {game.state.home_hand}
	{scale} 
	position={[0, 0]} 
    back = {game.state.home_back}
    drag = {true}
    anchor = {[50, 90]}
    on:dragend = {({ detail: { id } }) => {
        game.do_server({
            task: 'PLAY',
            data: { id }
        })
    }}
/>


<Hand 
    {...deck}
    anchor = {[90, 70]}
    cards = {game.state.home_deck}
    position={[0, 0]} 
    back = {game.state.home_back}
    on:click = {() => {
        game.do_server({
            task: 'DRAW'
        })
    }}
/>

<Hand 
    cards = {play_home}
	position={[0, 0]} 
    anchor ={[50, 50]}
    scale = 0.4
    back = {game.state.home_back}
/>

<Hand 
    cards = {play_away}
	position={[0, 0]} 
    anchor ={[50, 50]}
    scale = 0.4
    back = {game.state.away_back}
/>



<Hand 
	{...discard}
    cards = {game.state.home_discard}
	position={[0, 0]} 
    anchor ={[0, 90]}
    back = {game.state.home_back}
/>


<!-- Away Hands -->
<Hand 
	cards = {game.state.away_hand}
	{scale}
	anchor={[50, 0]} 
	interact={false}
	color={180}
    
    invert
    back = {game.state.away_back}
/>

<Hand 
	{...deck}
    cards = {game.state.away_deck}
	color={180}
	anchor={[90, 30]}
    back = {game.state.away_back}
/>

<Hand 
	{...discard}
    cards = {game.state.away_discard}
    anchor={[0, 10]}
    back = {game.state.away_back}
/>

<!-- Gem Dragon -->
{#each arr_home_gems as item, i }
<Spatial 
    anchor={[50, 70]}
    bias={[50, 100]} 
    position={circle({i: i + $tick * 0.368, scale: $scaling})}
    scale={1 + Math.sin(i - $tick * 0.5) * 0.1 }
    rotate={90 + Math.abs(Math.sin(i - $tick * 0.05)) * 45 }
>   
    <Gem {...item} i={(i % 8 === 0 ? 0 : i + $tick * 0.25)  } />
</Spatial>
{/each}

<!-- Heart dragon -->
{#each arr_home_hearts as item, i }
<Spatial 
    anchor={[50, 70]}
    bias={[50, 50]} 
    zIndex={-20}
    position={ circle_heart({i: i + $tick * 0.168, scale: $scaling})}
    scale={1 + Math.sin(i - $tick * 0.5) * 0.1 }
>   
    <Heart {...item} {i}  />
</Spatial>
{/each}

{#each $home_tokens as item, i }

<Spatial 
    anchor={[50, 70]}
    bias={[50, 50]} 
    zIndex={-1000}
    area={[-30, -40]}
    position={[0, 25]}
    scale={3 + Math.sin(i - $tick * 0.168) * 0.1 }
>   
    <Token {...item} {i}  />
</Spatial>
{/each}
<!-- 
<Pattern 
    anchor={[50, 60]}
    bias={[50, 50]}
    items={arr_home_tokens}
    vertex={Grid({
        columns: 7
    })}
>
</Pattern> -->
</div>

<style>
.game {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
}
</style>