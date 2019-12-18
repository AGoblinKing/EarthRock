<script>
import { load, image } from "/sys/file.js"
import Postage from "/ui/weave/Postage.svelte"
import * as knots from "/weave/knots.js"

import color from "/ui/action/color.js"

$: arr_knots = Object.entries(knots)

let last = {

}
let files
let nameit = false
const drop = (e) => {
  dragover = false

  const files = e.dataTransfer.files
  for (let i = 0; i < files.length; i++) {
    const reader = new FileReader()

    reader.onloadend = (e) => {
      last = files[i]
      nameit = load(e.target.result)
      if (!nameit) return
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

  const weave = Wheel.get(name)

  weave.update({
    INFO: {
      knot: `stitch`,
      value: {
        from: last.name,
        "save last": last.lastModified,
        size: last.size
      }
    }
  })

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
    {#await image(name) then src}
      <img  class="flex" {src} alt="fileicon"/>
    {/await}
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
    <div class="true" on:click={play_it}>Plant</div>
  </div>
</div>
{/if}

<div
  class="picker"

  on:drop={drop}
  on:dragover={over(true)}
  on:dragleave={over(false)}
/>

<input
  type="file"
  class="file"
  bind:this={files}
  multiple="multiple"
  on:change={(e) => {
    console.log(e.dataTransfer, e.target)
  }}
/>

<style>
.spirit {
  margin: 1rem;
  height: 10rem;
  display: flex;
  width: 10rem;
}
.nameit {
  background-color: #111;
  border: 0.25rem solid #333;
}
.file {
  display: none;
}
.flex {
  flex: 1;
}
.picker {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 6;
  width: 100%;
  color: #0c4213;
  height: 100%;
  transition: all 250ms cubic-bezier(0.075, 0.82, 0.165, 1);
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
  z-index: 10011;
  border: 1rem solid black;
}

</style>