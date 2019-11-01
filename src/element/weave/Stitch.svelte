<script>
import Channel from "./Channel.svelte"
import { random } from "/util/text.js"
import { writable } from "svelte/store"

export let hole

let weave_add = ``

$: value = hole.value
$: name = hole.name

const check_add = ({ which }) => {
  if (which !== 13) return
  const val = $value

  if (weave_add[0] === `-`) {
    delete val[weave_add.slice(1)]
  } else {
    val[weave_add] = writable(random(2))
  }

  value.set(val)
  weave_add = ``
}
</script>



<div class="board">
    {#each Object.entries($value) as [chan_name, chan] (chan_name)}
      <Channel {chan} {hole} name={chan_name}/>
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

.add_channel:hover {
  background-color: #151;
}

.add_channel {
  flex: 1;
  text-transform: uppercase;
  color: white;
  text-align: center;
  width: 20rem;

}



.board {
  padding-top: 0.5rem;
  text-align: center;
  color: white;
  text-transform: uppercase;
  display: flex;
  flex-direction: column;
  width: 30rem;
  align-items: center;
}

</style>
