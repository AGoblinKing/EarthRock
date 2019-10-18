<script>
import Board from "./Board.svelte"
import Intro from "./Intro.svelte"
import Card from "./Card.svelte"

$: focus = true

const defocus = () => {
	focus = !focus
}
</script>

<Card {focus} home></Card>
<div on:click="{defocus}">
	<Intro></Intro>
</div>
<!-- <Board opponent></Board>
<Board></Board> -->

<style>
</style>
