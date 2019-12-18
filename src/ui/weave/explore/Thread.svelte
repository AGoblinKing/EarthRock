<script>
import color from "/ui/action/color.js"
import { tick } from "/sys/time.js"
import { THEME_BG, THEME_BORDER } from "/sys/flag.js"

import { translate, format, compile, condense } from "/weave/thread.js"

export let channel
export let stitch
export let weave

$: feed = Wheel.feed

let editing = false
$: address = `${stitch.id.get()}/${channel[0]}`
$: threads = weave.threads

$: chain = $threads && weave.chain(address).slice(0, -1)

$: boxes = chain
  .map((i) => translate(i, weave))
  .join(` => `)

$: time_cut = $tick && Date.now() - 1000

$: tru_thread = chain
let edit = ``

const focus = (node) => node.focus()

const execute = () => {
  if (!editing) return
  editing = false
  compile(edit, weave, address)
}

$:style = [
  `border: 0.25rem solid ${$THEME_BORDER};`,
  `background-color: ${$THEME_BG};`
].join(``)

const do_edit = (e) => {
  e.preventDefault()
  e.stopPropagation()
  if (weave.name.get() === Wheel.SYSTEM) return
  if (editing) return
  editing = true
  edit = format(boxes)
}
</script>

{#if editing}
<textarea
  spellcheck="false"
  class="edit"
  type="text"
  style={`background-color: ${$THEME_BG}; border:0.5rem solid ${$THEME_BORDER};`}
  use:focus
  bind:value={edit}
  on:click={(e) => e.stopPropagation()}
  on:blur={(e) => {
    execute()
  }}
/>
{/if}

<div
  class="spot"
  on:click={do_edit}
>
  {#each tru_thread as link}
    {#if link[0] === `#`}
      <div
        class="thread"
        {style}
        class:active={chain.some((item) => $feed[`${weave.name.get()}/${item}`] > time_cut)}
      >
        {link}
      </div>
    {:else}
      <div
        class="thread"
        {style}
        use:color={condense(link, weave)}
        class:active={$feed[`${weave.name.get()}/${link}`] > time_cut}
      >
        {condense(link, weave)}
      </div>
    {/if}
  {/each}

</div>

<div
  class="cap"
  on:click={do_edit}
/>

<style>
.spot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  position: absolute;
  right: 20%;
  margin-right: -2rem;
  width: auto;
  margin-top: -0.2rem;
}


.thread {
  padding: 0.5rem;
  white-space: nowrap;
  transition: all 100ms linear;
  margin-right: -0.2rem;
  border-radius: 0.25rem;
}

.thread.active {
  text-decoration: underline;
}

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

.thread:hover {
  color: white;
}

.cap {
  background-color: rgba(0,0,0,0.5);
  border-right: 0.25rem solid rgba(255,255,255,0.0.5);
  padding: 0.5rem;
  z-index: 2;

}
.cap:hover {
  background-color: rgba(255, 255, 255, 0.25);
}

</style>

