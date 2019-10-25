<script>
import Intro from "./Intro.svelte"
import Tools from "./Tools.svelte"
import Game from "./Game.svelte"
import Tiles from "./Tiles.svelte"

let playing = window.location.pathname === "/play"

const start = () => {
    playing = true
    history.pushState({page: 1}, "", "/play")
}

const end = () => {
    playing = false 
    history.pushState({page: 1}, "", "/")
}

</script>

{#if playing}
    <Game on:end={end}/>
{:else} 
    <Intro on:start={start}/>
{/if}

<Tools on:end={end} {playing}/>

<div class="background">
    <Tiles random/>
</div>

<style>
.background {
    display: flex;
    z-index: 0;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    position: absolute;
    filter: sepia(1) hue-rotate(-90deg);
    opacity: 0.05;
    pointer-events: none;
}
</style>