<script>
import { THEME_BG, THEME_BORDER } from "/sys/flag.js"
import { compile } from "/thread/thread.js"

export let code
export let weave
export let address

export let ondone = () => {}

const focus = (node) => node.focus()

const execute = () => {
  ondone()
  compile(code, weave, address)
}
</script>


<textarea
  spellcheck="false"
  class="edit"
  type="text"
  style={`background-color: ${$THEME_BG}; border:0.5rem solid ${$THEME_BORDER};`}
  use:focus
  bind:value={code}
  on:click={(e) => e.stopPropagation()}
  on:keydown={(e) => {
    if (e.ctrlKey && e.which === 13) {
      execute()
      e.preventDefault()
      e.stopPropagation()
    }
  }}
  on:blur={(e) => {
    execute()
  }}
/>

<style>
.edit {
  position: fixed;
  left: 25%;
  top: 20%;
  width: 60rem;
  height: 60rem;
  z-index: 3;
  margin: 0;
  padding: 1rem;
  color: rgb(224, 168, 83);
}
</style>