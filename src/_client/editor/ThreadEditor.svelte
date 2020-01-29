<script>
import { THEME_BG, THEME_BORDER } from "/sys/flag.js"
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
	spellcheck="false"
	class="edit"
	type="text"
	style={`background-color: ${$THEME_BG}; border:0.5rem solid ${$THEME_BORDER};`}
	use:focus
	bind:value={code}
	on:click={(e) => e.stopPropagation()}
	on:keydown={(e) => {
		if (e.key.toLowerCase() === `end`) {
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
  top: 20%;
  width: 60rem;
  height: 60rem;
  z-index: 3;
  margin: 0;
  padding: 1rem;
  color: rgb(224, 168, 83);
  user-select: all !important;
}
</style>