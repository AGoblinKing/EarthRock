<script>
import {writable} from "svelte/store"
import { fade, fly} from 'svelte/transition'

import Pattern from "./Pattern.svelte"
import Spatial from "./Spatial.svelte"

import game from "../game.js"
import Hand from "./Hand.svelte"
import Gem from "./Gem.svelte"

const {home_gems} = game.state

$: arr_home_gems = Array.from(Array($home_gems))
const scale = 0.25;

const deck = {
	scale,
    spread: 0,
    max: 4,
    reverse: true,
    interact: false,
}

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

<Pattern anchor={[90, 90]} items={arr_home_gems} >
    <Gem />
</Pattern>

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