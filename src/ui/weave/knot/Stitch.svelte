<script>
import { THEME_BG } from "/sys/flag.js"
import border from "/ui/action/border.js"
import { focus } from "/sys/input.js"
import Postage from "/ui/weave/Postage.svelte"
import Channel from "./stitch/Channel.svelte"
import color from "/ui/action/color.js"
import { write } from "/util/store.js"
import { woven } from "/sys/weave.js"

import Port from "/ui/weave/Port.svelte"

export let knot
let weave_add = ``

$: id = knot.id
$: value = knot.value
$: name = knot.name

$: is_sys = $woven.name.get() === Wheel.SYSTEM

const check_add = ({ which }) => {
  if (is_sys) {
    return console.warn(`Tried to add/remove to ${Wheel.SYSTEM}`)
  }

  if (which !== 13) return
  const val = $value

  if (weave_add[0] === `-`) {
    delete val[weave_add.slice(1)]
  } else {
    val[weave_add] = write()
  }

  focus.set(`${$id}/${weave_add}`)
  value.set(val)
  weave_add = ``
}
</script>

<div class="port" use:border style={`background-color:${$THEME_BG};`}>
  <Port address={`${$id}|read`} />
</div>


<div class="nameit" use:border>
  <div 
    use:color={$name}
    class="header"
  >
    <input type="text"  class="edit"  bind:value={$name} placeholder="Name It!"/>
  </div>
</div>

<div class="board">
  <div class="postage">
    <Postage 
      address={`/${$woven.name.get()}/${$name}`} 
    />
  </div>
    {#each Object.entries($value) as [chan_name, chan] (chan_name)}
      <Channel {chan} {knot} name={chan_name}/>
    {:else}
      <div class="no-stitches">/\/\</div>
    {/each}
   
   {#if !is_sys}
    <input
      type="text" 
      class="add_channel" 
      use:border
      style={`background-color: ${$THEME_BG};`}
      bind:value={weave_add} 
      on:keypress={check_add} 
      on:blur={() => { weave_add = `` }}
      placeholder={`-${Object.keys($value)[0]}?`}
    />
  {/if}
</div>


<style>
.postage {
  position: absolute;
  width: 20rem;
  height: 20rem;
  align-self: center;
  display: flex;
  justify-self: center;
  opacity: 0.025;
  pointer-events: none;
}

.no-stitches {
  font-size: 7rem;
  justify-self: center;
  align-self: center;
}
.add_channel:hover {
  background-color: #151;
}

.header {
  display: flex;
  flex-direction: column;
}

.add_channel {
  border-bottom: none !important;
  border-left: none !important;
  border-right: none !important;
  padding: 1rem;
  flex: 1;
  text-align: center;
  font-size: 1.25rem;
  width: 25rem;

}
.port {
  align-self: center;
  position: absolute;
  margin-top: -5rem;
  background-color: #222;
}

.board {
  padding-top: 0.5rem;
  text-align: center;
  color: rgb(224, 168, 83);
  display: flex;
  flex-direction: column;
  width: 25rem;
  align-items: center;
 
}

.nameit {
  background-color: #222;
  width: 100%;
  border-top: none !important;
  border-left: none !important;
  font-size: 1.25rem;
  border-right: none !important;
}

.edit {
  text-align: center;
  padding: 1rem;
  width: 100%;
  font-size: 1.25rem;
}

.edit:hover {
  background-color: green;
}

</style>
