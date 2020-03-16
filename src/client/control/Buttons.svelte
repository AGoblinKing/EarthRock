<script>
import { key_virtual } from "src/client/sys/keyboard"
import { cursor } from "src/client/ui/action/nav"
import Tile from "src/client/ui/image/Tile.svelte"

import { Store } from "src/store"

const pressed = new Store(new Set())

const press = (command) => {
	$pressed.add(command)
	pressed.set($pressed)
	if (typeof command === `string`) return key_virtual.set(command)
}

const move = (command) => {
	let center
	let last_move

	return (e) => {
		if (!e.$cursor) return
		center = [
			e.$cursor.offsetLeft + e.$cursor.offsetWidth / 2,
			e.$cursor.offsetTop + e.$cursor.offsetHeight / 2
		]

		if (typeof command === `string`) return
		const [up, down, left, right] = command
		last_move = [up, left]
	}
}

const unpress = (command) => () => {
	$pressed.delete(command)
	pressed.set($pressed)
	if (typeof command === `string`) key_virtual.set(`${command}!`)
}

export let keys = []
</script>

<div class="group">
{#each keys as row}
  <div class="row">
	{#each row as [command, tile, keyboard]}
    {#if command}
		<div
			class="button"
			class:active={$pressed.has(command)}
			on:touchmove={move(command)}
			on:touchstart={press(command)}
			on:touchend={unpress(command)}
		>
      {#if keyboard && keyboard() && $cursor}
        <input type="text" class="phantom"
          on:click={() => {
            press(command)
            unpress(command)
            $cursor.focus()
          }}
        />
      {/if}
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
.phantom {
  position: absolute;
  width: 5.5rem;
  height: 6rem;
}

.row {
	display: flex;
}

.button {
	background-color: rgba(224, 168, 83,0.1);
	pointer-events: all;
	display: flex;
	width: 7rem;
	height: 7rem;
	margin: 0.5rem;
	opacity: 0.5;
	transition: all 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
	border-radius: 7rem;
}

.button.active {
	box-shadow:
		0 0 2rem rgba(224, 168, 83,0.5),
		inset 0 2rem 0.25rem rgba(224, 168, 83,0.1),
		inset 0 -2rem 0.25rem rgba(224, 168, 83,0.1),
		inset 2rem 0 0.25rem rgba(224, 168, 83,0.1),
		inset -2rem 0 0.25rem rgba(224, 168, 83,0.1) !important;
	opacity: 1;
}
.button.noactive {
	background-color: none;
}

.button.noactive:active {
	background-color: none;
}
</style>