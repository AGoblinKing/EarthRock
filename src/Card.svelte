<script>
import Tiles from "./Tiles.svelte"

export let id = "foobar"
export let cost = 0
export let name = "16 55 33 44 55"
export let flip = true
export let borders = true
export let vitals = [1, 1]
export let invert = false
export let interact = true
export let position = [0, 0]
export let rotation = 0
export let scale = 1
export let color = 90

const lines = [0, 1, 2]

const delay = ({
    time = 250,
    on = () => {},
    off = () => {}
}) => {
    let timeout
    
    return {
        on: () => {
            if(timeout) {
                clearTimeout(timeout)
            }
            on()
        },
        off: () => {
            if(timeout) {
                clearTimeout(timeout)
            }

            timeout = setTimeout(() => {
                timeout = 0
                off()
            }, time)
        }
    }
}

const doInteract = () => {
    return
    if(!interact) {
        return
    }

    flip = !flip
}

const delay_hover = delay({
    time: 250,
    on: () => {
        if(!interact) {
            return
        }
        hover = true
    },
    off: () => hover = false
})

let hover = false

$: tru_scale = hover ? scale * 1.168 : scale
$: style = `transform: translate(${-50 + position[0]}%, ${-50 + position[1] + (hover ? (invert ? 5 : -5) : 0)}%) rotate(${rotation}deg) scale(${tru_scale}) ; z-index: ${Math.round(tru_scale * 100)}`
</script>

<div {style} on:mouseenter={delay_hover.on} on:mouseleave={delay_hover.off} class="card">
    <div class:flip class="contents">
        {#if borders}
        <div class="border border-top" />
        <div class="border border-bottom" />
        <div class="border border-left" />
        <div class="border border-right" />
        {/if}

        <div 
            class="back" 
            on:click="{doInteract}"
            style="filter: sepia(1) hue-rotate({color}deg)"
        >
            <Tiles width={3} height={5} />
        </div>

        <div class="front" on:click="{doInteract}">
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
                <Tiles/>
            </div>
            <div class="details">
                {#each lines as line}
                <div class="line">
                    <div class="icon">
                        <div class="tile">
                            <Tiles width={1} height={1} />
                        </div>
                    </div>
                    <div class="vitals">
                        <div class="tile">
                            <Tiles width={1} height={1} />
                        </div>
                        {vitals[0]}
                        <div class="tile">
                            <Tiles width={1} height={1} />
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
    top: 50%;
    left: 50%;
    transition: transform 0.618s cubic-bezier(0.68, -0.55, 0.265, 1.55);
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
    transition: all 0.618s cubic-bezier(0.68, -0.55, 0.265, 1.55);
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
    transform: rotateX(0deg)
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