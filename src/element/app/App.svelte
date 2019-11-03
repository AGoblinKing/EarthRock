<script>
import Intro from "./Intro.svelte"
import Tools from "./Tools.svelte"
// import Game from "../game/Game.svelte"
import Tile from "../image/Tile.svelte"
import Design from "./Design.svelte"
import Weave from "../weave/Weave.svelte"
import Credits from "./Credits.svelte"
import {path} from "../../channel/path.js"

$: playing = $path === `play`
$: designing = $path === `cards`
$: weaving = $path === `weave`
$: root = $path === `/` || $path === ``
$: credits = $path === `credits`

const goto = (place) => () => path.set(place)
</script>

<!-- {#if playing}
    <Game on:end={end}/> -->
{#if designing}
    <Design on:end={goto(``)}/>
{:else if weaving}
    <Weave on:end={goto(``)} />
{:else}
    <Intro 
      on:start={goto(`start`)} 
      on:design={goto(`cards`)} 
      on:develop={goto(`weave`)}
      />
{/if}

<Tools on:end={goto(``)} {root}/>

<div class="background">
    <Tile random/>
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