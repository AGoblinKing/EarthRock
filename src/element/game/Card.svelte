<script>
import { writable } from "svelte/store"
import { onMount, createEventDispatcher } from "svelte"
import mouse_pos from "../mouse.js"
import Tiles from "./Tiles.svelte"
import { card as card_sound, wind_off, wind_on } from "../sounds.js"

const DRAG_SCALE = 0.5
const DRAG_TIME = 0.05

const dispatch = createEventDispatcher()

// Card Data
export let deck = ``
export let id = `foobar`
export let cost = 0
export let name = `16 55 33 44 55`
export let image = ``
export let effect1 = ``
export let effect2 = ``
export let effect3 = ``

// Deck Data
export let back = ``

// Card Display Attributes
export let borders = false
export let vitals = [1, 1]
export let invert = false
export let interact = true
export let drag = false
export let position = [0, 0]
export let position_raw = false
export let rotation = 0
export let scale = 1
export let color = 90
export let card = {}
export let young = true
export let fade = false
export let anchor = [50, 50]
export let played = false
const lines = [effect1, effect2, effect3]

// state flags
let dragging = false
let hover = false
let flip = true

onMount(() => {
  setTimeout(() => {
    young = false
    flip = !interact
  }, 250)
})

const delay = ({
  time = 250,
  on = () => {},
  off = () => {}
}) => {
  let timeout

  return {
    on: () => {
      if (!interact) {
        return
      }
      if (timeout) {
        clearTimeout(timeout)
      }
      on()
    },
    off: () => {
      if (!interact) {
        return
      }
      if (timeout) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => {
        timeout = 0
        off()
      }, time)
    }
  }
}

const beginInteract = () => {
  dispatch(`click`, card)

  if (drag) {
    dispatch(`dragstart`, card)
    dragging = true
    wind_on()
    const id = window.addEventListener(`mouseup`, () => {
      // give cancel ability
      dispatch(`dragend`, card)
      dragging = false
      window.removeEventListener(`mouseup`, id)
      wind_off()
    })
  }
}

const delay_hover = delay({
  time: 100,
  on: () => {
    hover = true
    card_sound()
  },
  off: () => hover = false
})

const onMouseEnter = () => {
  delay_hover.on()
}

const transform = () => {
  switch (true) {
    case dragging:
      return `transform: translate(${$mouse_pos[0] - window.innerWidth / 2 + tru_width}px, ${$mouse_pos[1] - window.innerHeight / 2 + tru_height}px) rotate(0deg) scale(${DRAG_SCALE});z-index: 1000`
    case position_raw:
      return `transform: translate(${position_raw[0] - window.innerWidth / 2 - tru_width}px, ${position_raw[1] - window.innerHeight / 2 - tru_height}px) rotate(${tru_rotation}deg) scale(${tru_scale}) ; z-index: ${Math.round(tru_scale * 100)}`
  }

  return `transform: translate(${position[0] * 5 + tru_width}px, ${(position[1] + (hover ? tru_invert * -5 : 0)) * 8 + tru_height}px) rotate(${tru_rotation}deg) scale(${tru_scale}) ; z-index: ${Math.round(tru_scale * 100) + 100}`
}

$: tru_scale = (hover ? scale * 1.168 : scale)
$: tru_rotation = hover ? 0 : rotation
$: tru_invert = invert ? -1 : 1
$: tru_anchor = dragging ? [50, 50] : anchor
$: tru_width = 250 * (tru_anchor[0] <= 50 ? -1 : 1)
$: tru_height = 400 * (tru_anchor[1] <= 50 ? -1 : 1)

$: transforms = transform(
  dragging,
  $mouse_pos,
  position,
  tru_width,
  hover,
  tru_invert,
  tru_height,
  tru_rotation,
  tru_scale,
  position_raw
)

$: style = [
  transforms,
  (tru_anchor[0] <= 50 ? `left: ${tru_anchor[0]}%` : `right: ${100 - tru_anchor[0]}%`),
  (tru_anchor[1] <= 50 ? `top: ${tru_anchor[1]}%` : `bottom: ${100 - tru_anchor[1]}%`)
].join(`;`)
</script>

<div {style} class:fade class:dragging on:mouseenter={onMouseEnter} on:mouseleave={delay_hover.off} class="card">
    <div class:flip class="contents">
        {#if borders}
        <div class="border border-top" />
        <div class="border border-bottom" />
        <div class="border border-left" />
        <div class="border border-right" />
        {/if}

        <div 
            class="back" 
            on:click="{beginInteract}"
            style="filter: sepia(1) hue-rotate({color}deg) brightness({fade ? 0.5 : 1})"
        >
            <Tiles width={3} height={5} data={back}/>
        </div>

        <div class="front" on:mousedown="{beginInteract}">
            <div class="header">
                <div class="title">
                    <Tiles 
                        data={name} 
                        width={5} 
                        height={1}
                    />
                </div>
                <div class="flex"></div>
                <div class="cost">{cost}</div>
            </div>
            <div class="image">
                <Tiles width={5} height={5} data={image}/>
            </div>
            <div class="details">
                {#each lines as line}
                <div class="line">
                    <div class="icon">
                        <div class="tile">
                            <Tiles width={1} height={1} random />
                        </div>
                    </div>
                    <div class="vitals">
                        <div class="tile">
                            <Tiles width={1} height={1} random />
                        </div>
                        {vitals[0]}
                        <div class="tile">
                            <Tiles width={1} height={1} random />
                        </div>
                        {vitals[1]}
                    </div>
                </div>
                {/each}
                <div class="flex"></div>
            </div>
            <div class="earthrock">E A R T H R O C K</div>
        </div>
    </div>
</div>

<style>
.earthrock {
    color: #300;
    line-height: 1.2rem;
    font-size: 2rem;
}

.line, .image {
    border: 1rem solid #300;
    border-radius: 1rem;
}

.line {
    display: flex;
    margin: 1rem;
}

.tile {
    width: 5rem;
    height: 5rem;
    display: flex;
}

.cost, .vitals, .title {
    background-color: #300;
}

.icon {
    background-color: white;
    padding: 1rem;
}

.vitals {
    padding-left: 3rem;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-size: 4rem;
    padding: 1rem;
}

.details {
    align-self: center;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.back, .front {
    background-color: black;
}
.flex {
    flex: 1;
}

.cost {
    color: white;
    font-size: 5rem;
    padding: 1rem;
    padding-left: 2rem;

    border-bottom-left-radius: 1rem;
}

.card {
    z-index: 2;
    position: absolute;
    width: 50rem;
    height: 80rem;
    perspective: 1000px;
    transition: transform 0.42s cubic-bezier(0.68, -0.25, 0.265, 1.5);
    filter: drop-shadow(5rem 5rem 0 rgba(0,0,0,0.25));
}
.fade .front {
    filter: sepia(0.5) brightness(0.5);
}

.card.dragging {
    transition: none;
}
.image {
    display: flex;
    margin: 2rem 4rem;
    height: 30rem;
    width: 40rem;
    border-radius: 1rem;
}

.header {
    display: flex;
}

.title {
    padding: 1rem;
    display: flex;
    height: 5rem;
    width: 25rem;
    border-bottom-right-radius: 1rem;
}

.contents {
    text-align: center;
    width: 100%;
    position: relative;
    height: 100%;
    transition: all 0.618s cubic-bezier(0.68, -1, 0.265, 2);
    transform-style: preserve-3d;
    transform:  rotateY(0deg);
}

.flip {
    transform: rotateY(180deg);
}

.front {
    display: flex;
    flex-direction: column;
    border: 2rem solid #300;
    transform: rotateX(0deg);

}

.border {
    position: absolute;
    z-index: 6;
    border: 2rem solid #111;
}

.border-top, .border-bottom {
    width: 100%;
    height: 0rem;
    transform: rotateX(90deg)
}

.border-top {
    top: -2rem;
}

.border-bottom {
    bottom: -6rem;
}

.border-right, .border-left {
    height: 100%;
    width: 0rem;
    transform: rotateY(90deg);
}

.border-left {
    left: -2rem;
}

.border-right {
    right: -6rem;
}

.front, .back {
    position: absolute;
    background-color: rgb(95, 63, 63);
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    cursor: pointer;
}

.back {
    transform: rotateY(180deg);
    display: flex;
    border: 2rem solid #010;
}

</style>