<script>
import exif from "piexifjs"

import Postage from "/ui/weave/Postage.svelte"
import { positions, woven } from "/sys/weave.js"
import * as knots from "/weave/knots.js"
import { scale, size } from "/sys/screen.js"
import { match, del } from "/sys/port-connection.js"
import color from "/ui/action/color.js"

import Knot_Factory from "/weave/knot.js"

import Knot from "./Knot.svelte"

export let weave

const knot = Knot_Factory()

let position = [0, 0, 0]
let picking = false

const pick = (e) => {
  position = [
    e.x - $size[0] / 2 - 5 * $scale,
    e.y - $size[1] / 2 - 1 * $scale,
    0
  ]

  picking = true
}

const nopick = () => {
  picking = false
}

const create = (k) => {
  const knot_new = weave.add({
    knot: k
  })
  const i = knot_new.id.get()
  const ps = positions.get()
  ps[i] = [...position]

  positions.set(ps)
}

const cancel = () => cancels.forEach(fn => fn())

const cancels = [
  match.subscribe((new_match) => {
    if (!new_match) return

    weave.give_thread.set(new_match)
  }),

  del.subscribe((port) => {
    if (!port) return
    const [id, type] = port.split(`|`)
    if (type === `write`) return

    weave.take_thread.set(id)
  })
]

$: arr_knots = Object.entries(knots)

let files
let nameit = false
const drop = (e) => {
  const files = e.dataTransfer.files
  for (let i = 0; i < files.length; i++) {
    const reader = new FileReader()

    reader.onloadend = (e) => {
      const r = exif.load(e.target.result)

      nameit = JSON.parse(r[`0th`][exif.ImageIFD.Make])
      name = `${nameit.name}`
    }
    reader.readAsDataURL(files[i])
  }
  e.preventDefault()
  e.stopPropagation()
}
let dragover

const over = (whether) => (e) => {
  e.dataTransfer.dropEffect = `copy`
  dragover = whether
  e.preventDefault()
  e.stopPropagation()
}

const play_it = () => {
  delete nameit.id

  Wheel.spawn({
    [name]: nameit
  })
  woven.set(name)
  nameit = false
}
let name
</script>
{#if nameit}
<div 
  class="nameprompt"
  use:color={`/${name}`}
>
  <h2>Name It!</h2>

  <div class="spirit">
    <Postage address={`/${name}`} nopunch={true} />
  </div>

  <input
    class="nameit" 
    on:keydown={(e) => {
      if (e.which !== 13) return
      play_it()
    }}
    type="text" 
    bind:value={name} 
    placeholder="Name it" 
  />
  <div class="controls">
    <div class="false" on:click={() => { nameit = false }}>Cancel</div>
    <div class="true" on:click={play_it}>Play</div>
  </div>
</div>
{/if}
<div 
  class="picker" 
  class:picking 
  class:dragover
  on:mousedown={pick}
  on:drop={drop}
  on:dragover={over(true)}
  on:dragleave={over(false)}
>

<input 
  type="file" 
  class="file" 
  bind:this={files} 
  multiple="multiple"
  on:change={(e) => {
    console.log(e.dataTransfer, e.target)
  }}
/>
{#if picking}
  <Knot {position} {knot}>
    <div class="prompt">
      <div class="title">
      SPAWN A ...
      </div>
      {#each arr_knots as [kind, fn] (kind)}
        <div class="kind" use:color={kind} on:mouseup={() => create(kind)}>
          {kind}
        </div>
      {/each}
    </div>
  </Knot>
{/if}
</div>

<svelte:window on:mouseup={nopick} />

<style>
.spirit {
  margin: 1rem;
  height: 10rem;
  width: 10rem;
}
.nameit {
  background-color: #111;
  border: 0.25rem solid #333;
}
.file {
  display: none;
}
.picker {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 6;
  width: 100%;
  height: 100%;
  transition: all 250ms cubic-bezier(0.075, 0.82, 0.165, 1);
}

.picking {
  z-index: 1001;
  background-color: rgba(0, 0, 0, 0.25)
}

.kind:hover {
  background-color: #333;
}
.title {
  padding: 1rem;
  color: rgb(224, 168, 83);
}

.kind {
  color: rgb(224, 168, 83);
  margin: 0;
  text-transform: uppercase;
  text-align: center;
  padding: 0.5rem;
  /* transition: all 250ms cubic-bezier(0.075, 0.82, 0.165, 1); */
}
.dragover {
  background: rgba(0, 255, 0, 0.1);
}
.kind:hover {
  filter: invert(1);
}
.controls {
  display: flex; 
  justify-content: flex-end;
}
.false:hover, .true:hover {
  background-color: blue;
}
.false, .true {
  padding: 1rem;
  border: 0.25rem solid #333;
  margin: 0.25rem;
}
.false {
  background-color: red;
}
.true {
  background-color: green;
}
.nameprompt {
  flex-direction: column;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 50%;
  padding: 5rem;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #111;
  z-index: 1001;
  border: 1rem solid black;
}

</style>