<script>
import Intro from "./Intro.svelte"
import Tools from "./Tools.svelte"
// import Game from "../game/Game.svelte"
import Tile from "../image/Tile.svelte"
import Design from "./Design.svelte"
import Weave from "/ui/weave/Weave.svelte"
import Credits from "./Credits.svelte"
import { path } from "/sys/path.js"
import { derived } from "/util/store.js"
import { tick } from "/sys/time.js"

const paths = {
  cards: Design,
  weave: Weave,
  credits: Credits
}

const view = derived(path, ([$path]) => paths[$path[0]] || Intro)
</script>

<svelte:component 
  this={$view}
/>

<Tools />

<div class="background">
    <Tile random width={50} height={50} />
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
    filter: sepia(1) hue-rotate(-90deg) lighten(0.5);
    opacity: 0.05;
    pointer-events: none;
}
</style>