<script>
import game from "./game.js"
import Hand from "./Hand.svelte"

const scale = 0.25;

const deck = {
	scale,
    spread: 1,
    max: 4,
    reverse: true,
    interact: false,
}

const discard = {
    scale,
    spread: 5,
    spread_y: 0,
    rotate: 0,
    rotation: 90,
    fade: true,
    drag: true,
    max: 7
}

game.server_fake()

</script>

<!-- Home Hands -->
<Hand 
	cards = {game.state.home_hand}
	{scale} 
	position={[0, 40]} 
    back = {game.state.home_back}
    drag = {true}
    on:dragend = {({ detail: { id } }) => {

        game.do_server({
            task: 'PLAY',
            data: { id }
        })
    }}
/>

<Hand 
	{...deck}
    cards = {game.state.home_deck}
	position={[90, 40]} 
    back = {game.state.home_back}
    on:click = {() => {
        game.do_server({
            task: 'DRAW'
        })
    }}
/>

<Hand 
	{...discard}
    cards = {game.state.home_discard}
	position={[-110, 50]} 
    back = {game.state.home_back}
/>


<!-- Away Hands -->
<Hand 
	cards = {game.state.away_hand}
	{scale}
	position={[0, -40]} 
	interact={false}
	color={180}
	invert 
    back = {game.state.away_back}
/>

<Hand 
	invert 
	{...deck}
    cards = {game.state.away_deck}
	color={180}
	position={[90, -40]} 
    back = {game.state.away_back}
/>

<Hand 
	{...discard}
    cards = {game.state.away_discard}
	position={[-40, 40]} 
    back = {game.state.away_back}
    invert
/>
