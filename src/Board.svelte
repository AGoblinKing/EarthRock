<script>
import game from "./game.js"
import Hand from "./Hand.svelte"

const scale = 0.25;

const deck = {
	scale,
    spread: 0,
    max: 4,
    count_factor: 250,
	interact: false 
}

const discard = {
    scale,
    spread: 0,
    interact: false
}

game.server_fake()

</script>

<Hand 
	cards = {game.state.home_hand}
	{scale} 
	position={[0, 40]} 
    back = {game.state.home_back}
    drag = {true}
/>

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
	{...deck}
    cards = {game.state.home_deck}
	position={[90, 40]} 
    back = {game.state.home_back}
/>

<Hand 
	invert 
	{...deck}
    cards = {game.state.away_deck}
	color={180}
	position={[90, -40]} 
    back = {game.state.away_back}
/>