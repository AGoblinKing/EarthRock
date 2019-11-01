<script>
import { color } from "../../util/text.js"

import Port from "./Port.svelte"

export let node

let weave_add = ``

const chan = $node.chan

const check_add = ({ which }) => {
  if (which !== 13) return
  const c = $chan
  if (weave_add[0] === `-`) {
    delete c[weave_add.slice(1)]
  } else {
    c[weave_add] = true
  }

  chan.set(c)
  weave_add = ``
}

const address = (channel) => `${$node.id}|chan|${channel}`
</script>

<div class="board draggable">
    {#each Object.entries($chan) as [name, channel] (name)}
      <div class="channel">
        <Port writable address={`${address(name)}|write`}/>
        <div class="channel_name" style="color: {color(name)};">
          { name }
        </div>
        <Port address={`${address(name)}|read`} />
      </div>
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



.channel {
  display: flex;
  background-color: #333;
  margin: 0.5rem 0;
  padding: 0.5rem 1rem;
  justify-content: center;
  align-items: center;
  border:solid 0.25rem #111;

  width: 100%;
}

.channel:hover {
  filter: brightness(1.2);
}

.channel_name {
  color: white;
  text-align: center;
  font-size: 1rem;
  margin: 0;
  flex: 1;
  filter: drop-shadow(1px 1px 0 black) brightness(2);
}

.name {
  color: white;
  text-align: center;
  padding: 0;
  margin: 0;
  width: 20rem;
  font-size: 1.5rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  filter: drop-shadow(1px 1px 0 black) ;
}

.board {
  padding-top: 0.5rem;
  width: 20rem;
  text-align: center;
  color: white;
  text-transform: uppercase;
  display: flex;
  flex-direction: column;
  align-items: center;
}

</style>
