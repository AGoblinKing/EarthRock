<script>
import Tiles from "./Tiles.svelte"
import {person} from "../sounds.js"

export let empty = false
export let i = 0

$: is_first = i % 9 !== 0 
$: bright_default = empty ? 0 : 0.9
$: hue = `90deg`

let playing = false
const onMouseOver = () => {
    if(playing) {
        return
    }
    playing = true
    person()
    setTimeout(() => {
        playing = false
    }, 250)
}
</script>

<div class="heart" class:empty on:mouseenter={onMouseOver} style="{`filter:contrast(1.5) hue-rotate(${hue}) drop-shadow(0.2vh 0.2vw 0 rgba(0,0,0,0.5));`}">
    <Tiles data="88" width={1} height={1}/>
</div>

<style>
.heart {
    border-radius: 0.5rem;
    display: flex;
    width: 2rem;
    height: 2rem;
    overflow:hidden;
    border: 0.1rem inset black;
    background-color: black;
    transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1)
}

.heart.empty {
    opacity: 0;
}

.heart:hover  {
    filter: contrast(5) hue-rotate(45deg) !important;
}
</style>