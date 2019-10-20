<script>
import Hand from "./Hand.svelte"

const scale = 0.2;
let cards = [{id: 1}, {id:2}, {id:3}, {id:4}, {id:5}]

const deck = {
	cards: [],
	scale,
	spread: 0,
	interact: false 
}

for(let id = 0; id < 3; id++) {
    deck.cards.push({ id })
}

const draw = () => {
    cards.push({ 
        id: cards.length + 1, 
        position: [90, 40], 
        flip :true
    })
    cards = cards
}

</script>

<Hand 
	{cards} 
	{scale} 
	position={[0, 40]} 
/>

<Hand 
	{cards} 
	{scale}
	position={[0, -40]} 
	interact={false}
	color={180}
	invert 
/>

<Hand 
	{...deck}
	position={[90, 40]} 
    onclick={draw}
/>

<Hand 
	invert 
	{...deck}
	color={180}
	position={[90, -40]} 
/>