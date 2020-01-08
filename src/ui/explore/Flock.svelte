<script>
import color from "/ui/action/color.js"
import { THEME_BORDER } from "/sys/flag.js"
import { read } from "/store.js"

export let weave
export let birds = read([])
export let set_bird

let birdex = 0

$: bird = weave.get_id($birds[birdex])
$: bird_name = bird
	? bird.name()
	: read(``)

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
	<div class="navigation" style="background-color: {$THEME_BORDER}">
		<div
			class="button"
			on:click={() => {
				let bird_new = birdex - 1
				if (bird_new < 0) bird_new = $birds.length - 1
				if ($birds.length === undefined) bird_new = 0

				birdex = bird_new
			} }

			use:color={$bird_name}
		>&lt;</div>

		<div use:color={$bird_name}>{birdex + 1} / {$birds.length}</div>
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

.button:hover {
	background-color: gold;
	transition: all 250ms linear;
}

.navigation {
	display: flex;
	flex-basis: 1;
	margin-left: 2rem;
	justify-content: space-evenly;
}

.navigation > div {
	border-top: none;
	border-bottom: none;
	padding: 0.5rem;

}

</style>