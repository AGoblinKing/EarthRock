<script>
import Channel from "./stitch/Channel.svelte"
import color from "/ui/action/color.js"
import { random } from "/util/text.js"
import { write } from "/util/store.js"

export let knot

let weave_add = ``

$: value = knot.value
$: name = knot.name
const check_add = ({ which }) => {
  if (which !== 13) return
  const val = $value

  if (weave_add[0] === `-`) {
    delete val[weave_add.slice(1)]
  } else {
    val[weave_add] = write(random(2))
  }

  value.set(val)
  weave_add = ``
}
</script>

<div class="nameit">
  <div use:color={$name}>
    <input type="text"  class="edit"  bind:value={$name} placeholder="Name It!"/>
  </div>
</div>
<div class="board">
    {#each Object.entries($value) as [chan_name, chan] (chan_name)}
      <Channel {chan} {knot} name={chan_name}/>
    {:else}
      <div class="no-stitches">/\/\</div>
    {/each}
   
    <input 
      type="text" 
      class="add_channel" 
      bind:value={weave_add} 
      on:keypress={check_add} 
      on:blur={() => { weave_add = `` }}
      placeholder="STITCH IT!"
    />
 
</div>


<style>

.no-stitches {
  font-size: 7rem;
  justify-self: center;
  align-self: center;
}
.add_channel:hover {
  background-color: #151;
}

.add_channel {
  border-top: 0.25rem dashed #111;
  background-color: #333;
  flex: 1;
  color: white;
  text-align: center;
  width: 30rem;

}

.board {
  padding-top: 0.5rem;
  text-align: center;
  color: white;
  display: flex;
  flex-direction: column;
  width: 30rem;
  align-items: center;
}

.nameit {
  background-color: #222;
  width: 100%;
  border-bottom: 0.25rem dashed #333;
}

.edit {
  text-align: center;
  padding: 1rem;
  width: 100%;
}

.edit:hover {
  background-color: green;
}

</style>
