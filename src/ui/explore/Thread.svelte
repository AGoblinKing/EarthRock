<script>
import color from "/ui/action/color.js"
import ThreadEditor from "/ui/editor/ThreadEditor.svelte"
import Knot from "/ui/thread/Knot.svelte"

import { tick } from "/sys/time.js"
import { THEME_BG, THEME_BORDER } from "/sys/flag.js"

import { translate, format, condense } from "/thread/thread.js"

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

const execute = () => {
  if (!editing) return
  editing = false
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
  edit = format(weave.chain(address).slice(0, -1).map((i) => translate(i, weave))
    .join(` => `))
}
</script>

{#if editing}
  <ThreadEditor code={edit} ondone={execute} {weave} {address}/>
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
      <Knot {weave} id={link} />
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
  white-space: nowrap;
  transition: all 250ms ease-in-out;
  margin-right: -0.2rem;
  border-radius: 0.25rem;
   outline: 0.25rem solid rgba(0, 217, 255, 0);
}

.thread.active {
  outline: 0.25rem solid rgba(255, 115, 0, 0.25);
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

