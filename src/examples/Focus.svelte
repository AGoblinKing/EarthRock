<script>

import Intro from "./Intro.svelte"
import Card from "./Card.svelte"

$: card = {
	scale: 0.9,
	position: [0, 0],
	rotation: 0
}

const defocus = () => 
	card = card.scale === 1 
		? {
			scale: 0.25,
			position: [0, 40],
			rotation: 5
		} 
		: {
			scale: 0.9,
			position: [0, 0],
			rotation: 0
		}

</script>


<Card {...card}></Card>
<div on:click="{defocus}" class="intro_field">
	<Intro></Intro>
</div>


<style>

.intro_field {
    top: 0;
    position: absolute;
    left: 0;
    width: 100%;
    height: 100%;
}
</style>
