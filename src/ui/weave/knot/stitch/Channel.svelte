<script>
import { THEME_BG } from "/sys/flag.js"
import border from "/ui/action/border.js"
import focus from "/ui/action/focus.js"
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
<div class="channel" use:border style={`background-color:${$THEME_BG};`}>
  <Port writable address={`${address(name)}|write`}/>
  <div class="vbox">
    <div class="name" use:border>{name}</div>
    <input
      use:color={JSON.stringify(name)} 
      use:border
      class="edit" 
      type="text"
      use:focus={address(name)} 
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
  border-top: none !important;
}

.name, .edit {
  margin: 0;
  padding: 1rem;
  flex: 1;
  text-align: center;
}

.edit {
  border-top: none !important;
  border-bottom: none !important;
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
  font-size: 1.5rem;
  display: flex;
  margin: 2rem 0;
  padding: 0rem 0.5rem;
  justify-content: center;
  align-items: center;
  width: 40rem;
}

.channel:hover {
  filter: brightness(1.2);
}
</style>