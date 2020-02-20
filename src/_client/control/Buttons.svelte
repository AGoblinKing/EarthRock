<script>
import { key_virtual } from "/sys/key.js"
import Tile from "/_client/image/Tile.svelte"
import { CURSOR } from "/sys/flag.js"

const pressed = new Set()

const press = (command) => {
	pressed.add(command)
	if (typeof command === `string`) return key_virtual.set(command)
}

const move = (command) => {
	let center
	let last_move

	return (e) => {
		center = [
			e.target.offsetLeft + e.target.offsetWidth / 2,
			e.target.offsetTop + e.target.offsetHeight / 2
		]

		if (typeof command === `string`) return
		const [up, down, left, right] = command
		console.log(e, center)
		last_move = [up, left]
	}
}
const unpress = (command) => () => {
	pressed.delete(command)
	if (typeof command === `string`) key_virtual.set(`${command}!`)
}
export let keys = []
</script>

<div class="group">
{#each keys as row}
  <div class="row">
	{#each row as [command, tile]}
    {#if command}

		<div
      class="button"
      class:active={pressed.has(command)}
      on:touchmove={move(command)}
      on:touchstart={press(command)}
      on:touchend={unpress(command)}
    >
      <input type="text" class="foo" on:focus={() => {
        press(command)()
        unpress(command)()
        // $CURSOR.focus()
      }}/>
      <Tile width={1} height={1} data={`${tile}`} />
		</div>

    {:else}
    	<div class="button noactive" />
    {/if}
	{/each}
  </div>
{/each}
</div>


<style>

.row {
  display: flex;
}

.button {
  pointer-events: all;
  display: flex;
  width: 7rem;
  height: 7rem;
  margin: 0.5rem;
  transition: all 500ms linear;
  opacity: 0.5;
  border-radius: 0.5rem;
}

.button.active {
  background-color: yellow;
  opacity: 1;
}
.foo {
  pointer-events: all;
  position: absolute;
  width: 7rem;
  height: 7rem;
  z-index: 2;
}
.button.noactive:active {
  background-color: none;
}
</style>