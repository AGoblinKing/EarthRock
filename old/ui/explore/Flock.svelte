<script>
import color from "src/client/ui/action/color"
import { THEME_BORDER, THEME_STYLE } from "src/client/sys/flag"
import { Store } from "src/store"

export let weave
export let birds = new Store([])
export let set_bird

let birdex = 0

$: bird = weave.get_id($birds[birdex])
$: bird_name = bird ? bird.name() : new Store(``)

let last_bird = false
$: {
	if (last_bird === false) last_bird = bird

	if (bird && bird !== last_bird) {
		bird.birdex = birdex
		set_bird(bird)
		last_bird = bird
	}

	if (!bird) {
		requestAnimationFrame(() => {
			bird = weave.get_id($birds[birdex])
		})
	}
}
</script>

<div
	class="sub_space"
>

	<div class="navigation"
		style="background-color: {$THEME_BORDER}">
		<div
			class="button"
			on:click={() => {
				let bird_new = birdex - 1
				if (bird_new < 0) bird_new = $birds.length === 0 ? 0 : $birds.length - 1
				if ($birds.length === undefined) bird_new = 0

				birdex = bird_new
			} }

			use:color={$bird_name}
		>&lt;</div>
		<div class="flex">{`~~${$bird_name}~~`} : {birdex} : {$birds.length} </div>
		<div
			class="button"
			use:color={$bird_name}
			on:click={() => {
				let bird_new = birdex + 1
				if ($birds.length === undefined) bird_new = 0
				if (bird_new >= $birds.length) bird_new = 0

				birdex = bird_new
			} }
		>></div>
	</div>


	<slot />

</div>

<style>
.flex {
	flex: 1;
	display: flex;
	justify-content: space-evenly;
}

.button	 {
	padding: 0;

}

.button:hover {
	background-color: rgba(255, 217, 0, 0.555) !important;
	transition: all 250ms linear;
}

.navigation {
	user-select: none;
	display: flex;
	flex-basis: 1;
	margin-left: 2rem;
	margin-right: 2rem;

}

.navigation > div {
	border-top: none;
	border-bottom: none;
	padding: 0.5rem;
}

</style>