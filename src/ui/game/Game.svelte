<script>
import { writable } from "svelte/store"
import { fade, fly } from 'svelte/transition'
import scaling from "../scaling.js"
import tick from "../tick.js"
import Spatial from "./Spatial.svelte"
import game from "../../sys/game.js"
import Hand from "./Hand.svelte"
import Gem from "./Gem.svelte"
import Heart from "./Heart.svelte"
import Token from "./Token.svelte"
import { Grid, Circle } from "../curves.js"
import { card as sound_card } from "../sounds.js"

const { home_gems, home_hearts, home_tokens } = game.state

$: arr_home_gems = Array.from(Array(9)).map((_, i) => ({
  empty: i < $home_gems
}))

$: arr_home_hearts = Array.from(Array(6)).map((_, i) => ({
  empty: i < $home_hearts
}))

const scale = 0.25

const deck = {
  scale,
  spread: 0,
  max: 4,
  reverse: true,
  interact: false
}
const circle = Circle({
  max: 32,
  radius: 50,
  wobble: [1, 15]
})

let gem_clutch = false
const circle_clutch = Circle({
  max: 9,
  radius: 50,
  wobble: [0, 0]
})

const circle_heart = Circle({
  max: 60,
  radius: 20

})

let heart_clutch = false
const circle_heart_clutch = Circle({
  max: 6,
  radius: 30,
  wobble: [5, 5]
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

let dragging = false
</script>

<div class="game" out:fly={{ delay: 100, duration: 1000, x: 0, y: 1000, opacity: 0 }}>

<!-- Home Hands -->
<Hand 
	cards = {game.state.home_hand}
	{scale} 
	position={[0, 0]} 
    back = {game.state.home_back}
    drag = {true}
    anchor = {[50, 90]}
    on:dragstart = {() => {
        dragging = true
    }}

    on:dragend = {({ detail: { id } }) => {
        game.do_server({
            task: `PLAY`,
            data: { id }
        })

        dragging = false
    }}
/>


<Hand 
    {...deck}
    anchor = {[90, 70]}
    cards = {game.state.home_deck}
    position={[0, 0]} 
    back = {game.state.home_back}
    on:click = {() => {
        sound_card()
        game.do_server({
            task: `DRAW`
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

<div on:click={() => gem_clutch = !gem_clutch }>

<!-- Gem Dragon -->
{#each arr_home_gems as item, i }
<Spatial 
    anchor={[50, 70]}
    position={
        gem_clutch
        ? circle_clutch({ i: i, scale: $scaling })
        : circle({ i: i + $tick * 0.2, scale: $scaling })
    }
    scale={1 + Math.sin(i - $tick * 0.5) * 0.1 }
    rotate={90 + Math.abs(Math.sin(i - $tick * 0.01)) * 45 }
>   
    <Gem {...item} i={(i % 8 === 0 ? 0 : i + $tick * 0.25)  } />
</Spatial>
{/each}
</div>

<div on:click={() => heart_clutch = !heart_clutch }>
<!-- Heart dragon -->
{#each arr_home_hearts as item, i }
<Spatial 
    anchor={[50, 70]}
    zIndex={-20}
    position={ 
        heart_clutch
        ? circle_heart_clutch({ i, scale: $scaling })
        : circle_heart({ i: i * 10 + $tick * 0.05, scale: $scaling })
    }
    scale={1 + Math.sin(i - $tick * 0.5) * 0.1 }
>   
    <Heart {...item} {i}  />
</Spatial>
{/each}
</div>
{#each $home_tokens as item, i }
<Spatial 
    anchor={[50, 70]}
    zIndex={-1000}
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