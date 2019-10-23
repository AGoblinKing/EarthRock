<script>
import { createEventDispatcher } from "svelte"
import {IS_DEV} from "../flags.js"

export let playing = false
const dispatch = createEventDispatcher()
const audio = new Audio("/music/earthrock-final-theme.mp3")
audio.loop = true
audio.volume = 0.5
let audo_playing = false

const toggle = () => {
    if(audo_playing) {
        audio.pause()
    } else {
        audio.play()
    }

    audo_playing = !audo_playing
}


if(!IS_DEV) {
    toggle()
}

</script>

<div class="tools">
    <div on:click={toggle}>
        {audo_playing ? '<>' : '>'}
    </div>
    {#if playing}
        <div on:click={() => dispatch("end")}>
            X
        </div>
    {/if}
</div>

<style>
.tools {
    display: flex;
    position: absolute; 
    right: 0;
    z-index: 110;
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