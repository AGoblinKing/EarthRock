<script>
import Port from "/ui/weave/Port.svelte"
import color from "/ui/action/color.js"

export let knot
export let chan
export let name

$: edit = JSON.stringify($chan)

$: id = knot.id

const save = () => {
  let v = $chan
  try {
    v = JSON.parse(edit)
    chan.set(v)
  } catch (ex) {
    // no boggie
    edit = JSON.stringify($chan)
  }
}
const address = (channel) => `${$id}/${channel}`
</script>
<div class="channel">
  <Port writable address={`${address(name)}|write`}/>
  <div class="vbox" use:color={JSON.stringify(name)}>
    <div class="name">{name}</div>
    <input 
      class="edit" 
      type="text" 
      bind:value={edit} 
      on:blur={() => {
        save()
      }}
      on:keydown={({ which }) => {
        if (which !== 13) return
        save()
      }}
      placeholder="JSON plz"
    />
  </div>
  <Port address={`${address(name)}|read`} />
</div>

<style>

.name {
  border-bottom: 0.25rem solid  #222;
}

.name, .edit {
  border-right: 0.25rem solid  #222;
  border-left: 0.25rem solid  #222;
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
  border:solid 0.25rem #111;
  width: 30rem;
}

.channel:hover {
  filter: brightness(1.2);
}
</style>