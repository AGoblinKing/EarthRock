<script>
import { fly } from 'svelte/transition'
import { linear } from 'svelte/easing'
import { button, button_press } from "/sound/ui.js"
import { path } from "/sys/path.js"

const dispatch = (target) =>
  path.set(target)

const mouseOver = () => {
  button()
}

const click = () => {
  button_press()
}

const discord = () => {
  window.open(`https://discord.gg/HnvRaKS`, `_blank`)
  click()
}

const develop = () => {
  dispatch(`weave`)
  click()
}
const credits = () => {
  dispatch(`credits`)
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
    <!-- <button  
        on:mouseenter={mouseOver} 
        on:click="{design}"
    >CARDS</button> -->

    <button  
        on:mouseenter={mouseOver} 
        on:click="{develop}"
    >WEAVE</button>

    <button 
        on:mouseenter={mouseOver} 
        on:click="{discord}"
    >SOCIAL</button>

    <button 
        on:mouseenter={mouseOver} 
        on:click="{credits}"
    >CREDITS</button>
 
</div>
<div class="notice">
  We don't use cookies or store anything about you server side.
  <br/>
  <a class="link" target="_new" href="https://github.com/AGoblinKing/EarthRock">
    [ GPL3 - //github.com/agoblinking/EarthRock]
  </a>
</div>

</div>

<style>
.link {
  color: white;

}
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

.title, .desc {
  color: white;
  text-align: center;
  filter: drop-shadow(0.25rem 0.25rem 0.25rem black);
}

.title {
    font-size: 10rem;
}

.desc {
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