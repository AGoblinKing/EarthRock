<script>
import { createEventDispatcher } from "svelte"
import { fade, fly } from 'svelte/transition'
import { linear } from 'svelte/easing'
import { button, button_press } from "../../sound/ui.js"
import { IS_DEV } from "../../channel/flags.js"

const dispatch = createEventDispatcher()

const mouseOver = () => {
  button()
}

const click = () => {
  button_press()
}

const start = () => {
  dispatch(`start`)
  click()
}

const design = () => {
  dispatch(`design`)
  click()
}

const discord = () => {
  window.open(`https://discord.gg/HnvRaKS`, `_blank`)
  click()
}

const develop = () => {
  dispatch(`develop`)
  click()
}
</script>

<div class="intro" out:fly={{ delay: 100, duration: 1000, x: 0, y: 4000, opacity: 0, easing: linear }}>
<h1 class="title">EarthRock</h1>
<h2 class="desc">The Uncollectable Card Game</h2>

<div class="menu">
    <!-- <button 
        on:mouseenter={mouseOver} 
        on:click="{start}"
    >PLAY</button>
     -->
    <button  
        on:mouseenter={mouseOver} 
        on:click="{design}"
    >CARDS</button>

    <button 
        on:mouseenter={mouseOver} 
        on:click="{discord}"
    >CHAT</button>

    <button  
        on:mouseenter={mouseOver} 
        on:click="{develop}"
    >WEAVE</button>
 
</div>
<div class="notice">We don't use cookies or store anything about you server side.</div>
</div>

<style>
.notice {
    position: absolute;
    bottom: 0;
    border-top: 0.5rem solid black;
    background-color: #333;
    color: white;
    width: 100%;
    padding: 0.5rem;
    text-align: center;
    line-height: 1.5rem;
}


.title {
    text-align: center;
    font-size: 10rem;
}

.desc {
    text-align: center;
    font-size: 2rem;
}

@media (max-width: 40rem) {
    .title {
        font-size: 4rem;
    }
    .desc {
        font-size: 1rem;
    }
}

button {

    border: 0.5rem solid #333;
    border-radius: 1rem;
    background-color: #666;
    color: white;
    text-align: center;
    font-size: 2rem;
    padding: 1rem;
    cursor: pointer;
}

.menu {
    position: absolute;
    top: 61.8%; 
    width: 50%;
    margin: 0 25%;
    display: flex;
    flex-direction: column;
}
.intro {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
}

button:hover {
    background-color: #333;
}
</style>