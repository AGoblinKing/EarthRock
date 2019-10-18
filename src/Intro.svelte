<script>
import anime from "animejs/lib/anime.es.js"
import Popup from "./Popup.svelte"
import Tiles from "./Tiles.svelte"

const clicked = () => {
    alert("Woah there speedy aint got nothing more yet")
}

anime({
  targets: '.title',
  points: [
    { value: [
      '70 24 119.574 60.369 100.145 117.631 50.855 101.631 3.426 54.369',
      '70 41 118.574 59.369 111.145 132.631 60.855 84.631 20.426 60.369']
    },
    { value: '70 6 119.574 60.369 100.145 117.631 39.855 117.631 55.426 68.369' },
    { value: '70 57 136.574 54.369 89.145 100.631 28.855 132.631 38.426 64.369' },
    { value: '70 24 119.574 60.369 100.145 117.631 50.855 101.631 3.426 54.369' }
  ],
  easing: 'easeOutQuad',
  duration: 2000,
  loop: true
});
</script>

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

.background {
    display: flex;
    z-index: 0;
    width: 100%;
    height: 100%;
    position: absolute;
    filter: sepia(1) hue-rotate(-90deg);
    opacity: 0.05
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
    position: absolute;
    border: 0.5rem solid #333;

    border-radius: 1rem;
    background-color: #666;
    color: white;
    text-align: center;
    margin: 0 25%;
    width: 50%;
    top: 61.8%; 
    font-size: 2rem;
    padding: 1rem;
    cursor: pointer;
}

button:hover {
    background-color: #333;
}
</style>

<div class="background">
    <Tiles />
</div>

<h1 class="title">EarthRock</h1>
<h2 class="desc">The Uncollectable Card Game</h2>

<button on:click="{clicked}">START</button>

<div class="notice">We don't use cookies or store anything about you server side.</div>
