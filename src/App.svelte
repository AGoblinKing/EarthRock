<script>
import Intro from "./Intro.svelte"
import Hand from "./Hand.svelte"

const scale = 0.3;
const cards = [{id: 1}, {id:2}, {id:3}, {id:4}, {id:5}]
const deck = {
	cards,
	scale,
	spread: 0,
	interact: false 
}
</script>

<Intro></Intro>

<Hand 
	{cards} 
	{scale} 
	position={[0, 40]} 
/>

<Hand 
	{...deck}
	position={[90, 40]} 
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
	invert 
	{...deck}
	color={180}
	position={[90, -40]} 
/>
