<script>
import { THEME_BG } from "/sys/flag.js"
import { compile } from "/weave/thread.js"

export let code
export let weave
export let address
export let right

export let ondone = () => {}

const focus = (node) => requestAnimationFrame(() => node.focus())

let editing = true

const execute = () => {
	// prevent back to back compiles
	if (!editing) return

	editing = false
	compile({ code, weave, address, right })
	ondone()
}
</script>


<textarea
	spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
	class="edit"
	type="text"
	style={`background-color: ${$THEME_BG};`}
	use:focus
	bind:value={code}
	color={code}
	on:click={(e) => e.stopPropagation()}
	on:keydown={(e) => {
		switch (e.key.toLowerCase()) {
			case `escape`:
			case `end`:
			e.preventDefault()
			e.stopPropagation()

			editing = false
			ondone()
			return
		}

		if (e.ctrlKey && e.which === 13) {
			execute()
			e.preventDefault()
			e.stopPropagation()
		}
	}}
	on:blur={(e) => {
		execute()
	}}
/>

<style>
.edit {
	position: fixed;
	left: 25%;
	right: 0;
	top: calc(25%/2);
	bottom: 0;
	z-index: 3;
	margin: 0;
	width: 50%;
	height: 75%;
	padding: 3rem;
	color: rgb(224, 168, 83);
	border-radius: 2rem;
	user-select: all !important;
}
</style>