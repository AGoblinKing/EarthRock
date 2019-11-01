<script>
import Port from "./Port.svelte"
import color from "/action/color.js"

export let hole
export let chan
export let name

const address = (channel) => `${hole.id}|chan|${channel}`
</script>
<div class="channel">
  <Port writable address={`${address(name)}|write`}/>
  <div class="vbox" >
    <div class="name" use:color={name}>{name}</div>
    <input type="text" use:color={$chan} class="edit" bind:value={$chan} placeholder="JSON plz"/>
  </div>
  <Port address={`${address(name)}|read`} />
</div>

<style>

.name {
  border-bottom: 0.25rem dashed #222;
}
.name, .edit {
  border-right: 0.25rem dashed #222;
  border-left: 0.25rem dashed #222;
  margin: 0;
  padding: 1rem;
  flex: 1;

  text-align: center;
}

.vbox {
  display: flex;
  flex: 1;
  flex-direction: column;
}
.edit:hover {
  background-color: green !important;
  
}
.channel {
  display: flex;
  background-color: #333;
  margin: 0.5rem 0;
  padding: 0rem 1rem;
  justify-content: center;
  align-items: center;
  border-radius: 1rem;
  border:solid 0.25rem #111;
  width: 35rem;
}

.channel:hover {
  filter: brightness(1.2);
}
</style>