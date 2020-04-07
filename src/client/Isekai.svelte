<script>
import Goblin from "./Goblin.svelte"

import { nav, cursor, goto } from "./action/nav"
import {color, random} from "src/lib/text"
import is from "src/client/is"
import { Tile } from "./image"

const path = is.sys.query("path", "path")

$: names = Object.keys($is)

const lines = [
  `M0 50 L15 15 L50 0 L85 15 L100 50 L85 85 L50 100 L 15 85 L0 50`,
  `M15 85 Q25 50, 50 50 T 85 15`,
  `M15 85 Q50 75, 50 50 T 85 15`,
  `M15 15 Q25 50, 50 50 T 85 85`,
  `M15 15 Q50 25, 50 50 T 85 85`,
  
  `M0 50 Q25 75, 50 50 T 100 50`,

  `M50 0 Q25 25, 50 50 T 50 100`,

  `M0 50 Q25 25, 50 50 T 100 50`,
  `M50 0 Q75 25, 50 50 T 50 100`
].join(` `)

const positions = [
    [15, 15],
    [15, 85],
    [85, 85],
    [85, 15],
    [0, 50],
    [50, 0],
    [100, 50],
    [50, 100]
]

let offset = [0, 0]
let scale = 1
let name = $path.length > 0 && $path[0] !== "" ? $path.join("/") : "EARTHROCK"

let goblin
$: tiny = name.length > 13

const nav_goblin = (idx) => ({
    id: `goblin-${idx}`,
    focus() {
        scale = 5
        offset = positions[idx].map(i => 50 - i * scale) 
        
        if(names[idx] === undefined) {
            names[idx] = random(2)
            is.add({
                [names[idx]]: {}
            })
        }

        goblin = names[idx]
    },

    blur() {
        goblin = undefined
    },

    cancel() {
        goto("workspace")
    }
})

</script>

<svg viewBox="-5 -5 110 110" class="svg isekai" 
    style="filter: drop-shadow(0 0 0.5rem {color(name)});"
>
    <g transform="
        translate({offset[0]}, {offset[1]})
        scale({scale})
        "
        class="map">
        <path d={lines} />

        {#each positions as [x, y], idx}
            <g  class="goblin" 
                use:nav={nav_goblin(idx)}
                on:mouseover={() => {
                    if($cursor && $cursor.id === `goblin-${idx}`) return

                    offset = positions[idx].map(i => (50 - i)/2)
                }}
            >
                <circle class="circle" cx="{x}" cy="{y}" />
                <text 
                    {x} y={y} 
                    class="goblin-name" 
                    font-size={$cursor && $cursor.id === `goblin-${idx}` ? 2 : 5} 
                    stroke={color(names[idx] || "EMPTY")}>
                    { names[idx] || ""}
                </text>
            </g>
        {/each}

        <text 
            class="name" 
            x="50" y="50" 
            font-size={tiny ? 5 : 10}
            stroke={color($path[0] || "gree")}
            stroke-width={tiny ? 0.25 : 0.5}
            on:mouseover={() => {
                offset = [0, 0]
            }}

            on:click={() => {
                window.open("https://www.patreon.com/earthrock")
            }}

            use:nav={{
                id: "workspace",
                origin: true,
                focus() {
                    offset = [0, 0]
                    scale = 1
                }
            }}
        >
            { name }
        </text>
    </g>
</svg>

{#if goblin}
    <Goblin name={goblin} />
{/if}

<style>

.map {
    transition: all 500ms ease-out;
}

.circle {
    r: 10;
    stroke-width: 0;
    fill: black;
}

path {
    stroke: rgba(0, 0, 0, 0.75);
}

:global(.nav.goblin) {
    pointer-events: none;
}

:global(.nav.goblin .circle)  {
    r: 15;
}

.goblin-name {
    transition: all 1s ease-out;
}

.goblin:hover circle,  .goblin:active circle {
    r: 15;
}

:global(.nav .goblin-name) {
    stroke-width: 0.1 !important;
   
}


.goblin circle {
    transition: all 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.goblin text {
    transition: all 500ms ease-out;
    font-size: 2;

    stroke-width: 0.3;
}

text {
    font-family: "sharetech";
    text-anchor: middle;
    dominant-baseline: middle;
    text-align: center;
    fill: rgb(0, 0, 0);
}

.name {
    fill: black;
    transition: all 250ms ease-in-out;
}

.svg  {
    stroke: black;
    stroke-width: 1;

    stroke-linejoin: round;
    stroke-linecap: round;
    fill: none;
}

.isekai {
	width: 100%;
	height: 100%;
	top: 50%;
	left: 50%;
	position: absolute;
	transform: translate(-50%, -50%);
}

</style>