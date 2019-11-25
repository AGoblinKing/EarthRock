<script>
import { test } from "../../sound/ui.js"
import Tile from "../image/Tile.svelte"

export let empty = false
export let i = 0

let hover = false

$: is_first = i % 9 !== 0
$: bright_default = empty ? 0.25 : 0.75
$: hue = `${empty ? -90 : 90}deg`
$: grayscale = empty ? 1 : 0

const mouseOver = () => {
  if (hover) {
    return
  }

  test()
  hover = true

  setTimeout(() => {
    hover = false
  }, 250)
}
</script>

<div
    class="gem"
    class:hover
    on:mouseover={mouseOver}
    class:empty
    style="{`filter: contrast(1.5) grayscale(${grayscale}) hue-rotate(${hue}) brightness(${bright_default}) drop-shadow(0.5vh -0.5vw 0 rgba(0,0,0,0.25));`}"
>
    <Tiles data="{(is_first ? 180 : 68).toString()}" width={1} height={1}/>
</div>

<style>
.gem {
    border-nadius: 2rem;
    display: flex;
    width: 2.5rem;
    border: 0.1rem inset black;
    background-color: black;
    height: 2.5rem;
    overflow:hidden;
    transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
}


.gem.hover  {
    filter: hue-rotate(0deg) !important;

}
</style>
