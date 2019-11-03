<script>
import { createEventDispatcher } from "svelte"
import { button_press, button } from "/sound/ui.js"
import {path} from "/channel/path.js"

const dispatch = createEventDispatcher()
const audio = new Audio(`/music/earthrock-final-theme.mp3`)
audio.loop = true
audio.volume = 0.5
let audo_playing = false

const toggle = () => {
  if (audo_playing) {
    audio.pause()
  } else {
    audio.play()
  }

  audo_playing = !audo_playing
}

const end = () => {
  dispatch(`end`)
  button_press()
}
</script>

<div class="tools">
    <div on:click={toggle}>
        {audo_playing ? `>` : `!>`}
    </div>
    {#if $path !== false && $path !== ``}
        <div on:click={end} on:mouseenter={button}>
            X
        </div>
    {/if}
</div>

<style>
.tools {
    display: flex;
    position: absolute; 
    right: 0;
    z-index: 1100;
}

.tools > * {
    display: flex;
    justify-content: center;
    align-content: center;
    cursor: pointer;
    font-size: 5rem;
    margin: 2rem;
    line-height: 5rem;
    text-align: center;
}
.tools > *:hover {
    color: #222;
}
.tools > *:active {
    color: #111;
}
</style>