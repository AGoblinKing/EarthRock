<script>
import { cursor } from "src/client/ui/action/nav"
import Buttons from "./Buttons.svelte"
import { keyboard } from "src/client/sys/device"

const commands = {
	_: [undefined, 0],
	u: [`arrowup`, 668],
	d: [`arrowdown`, 670],
	l: [`arrowleft`, 671, () => $cursor.keyboard],
	r: [`arrowright`, 669, () => $cursor.keyboard],
	___: [undefined, 0],
	pdn: [`pagedown`, 702],
	pup: [`pageup`, 700],
	ins: [`insert`, 858, () => true],
	del: [`delete`, 857],
	yes: [`enter`, 855, () => $cursor.keyboard],
	noo: [`end`, 856],
	exp: [`pause`, 820],
	und: [`backspace`, 12],
	red: [`redo`, 13],
	mod: [`shift`, 14],
	joy: [[`arrowup`, `arrowdown`, `arrowleft`, `arrowright`], 796]
}

const { _, u, d, r, l, joy, pup, pdn, noo, ins, del, yes, exp } = commands

const buttons_left = [
	[_, u, pup],
	[l, joy, r],
	[_, d, pdn]
]

const buttons_right = [
	[_, del, _],
	[ins, exp, noo],
	[_, yes, _]
]
</script>

{#if !$keyboard}
<div class="control">
  <div class="left">
    <Buttons keys={buttons_left} />
  </div>
  <div class="flex"></div>
  <div class="right">
    <Buttons keys={buttons_right}/>
  </div>
</div>
{/if}
<style>

.flex {
  flex: 1;
}
.control {
  pointer-events: none;
  display: flex;
  user-select: none;
  position: absolute;
  top: 0;
  left: 0;
  padding: 7rem;
  right: 0;
  bottom: 0;
  z-index: 1001;
}

.left, .right {
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
</style>