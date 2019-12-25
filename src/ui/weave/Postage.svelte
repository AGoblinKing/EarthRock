<script>
import Tile from "/ui/image/Tile.svelte"

export let address = ``

$: running = Wheel.running

const [, w_id, k_id] = address.split(`/`)

$: weave = Wheel.get(w_id) || Wheel.get(Wheel.SYSTEM)
$: names = weave.names

$: rezed = weave.rezed

$: knot = $names[k_id]

// TODO: sometimes use postage for bad reasons
$: id = knot
	? knot.id.get()
	: ``

$: isrunning = $running[w_id] === true
$: issystem = w_id === Wheel.SYSTEM
$: isrezed = $rezed[id]
</script>

<div
  class="postage"
  class:isrunning
  class:isrezed
  class:issystem
>
  <Tile
    width={1}
    height={1}
    text={address}
  />
</div>

<style>
.postage {
  flex: 1;
  display: flex;
  background-color: #111;
  filter: sepia(1) hue-rotate(-50deg)
    drop-shadow(-0.25rem 0.25rem 0 rgba(0,0,0,0.75))
    drop-shadow(0.25rem -0.25rem 0 rgba(0,0,0,0.75));

  padding: 0.25rem;
  border: 0.25rem solid  #333;
}
.postage:hover {
  background-color: green;
}
.postage:active {
  background-color: rgba(0,0,0,0.75);
  filter: sepia(1) hue-rotate(180deg)
    drop-shadow(0.25rem 0.25rem 0 rgba(0,0,0,0.75))
    drop-shadow(-0.25rem -0.25rem 0 rgba(0,0,0,0.75));
}

.postage.isrunning {
  filter: sepia(1) hue-rotate(90deg)
    drop-shadow(-0.25rem 0.25rem 0 rgba(0,0,0,0.75))
    drop-shadow(0.25rem -0.25rem 0 rgba(0,0,0,0.75));
}
.postage.isrunning:active {
  background-color: rgba(0,0,0,0.75);
  filter: sepia(1) hue-rotate(90deg)
    drop-shadow(0.25rem 0.25rem 0 rgba(0,0,0,0.75))
    drop-shadow(-0.25rem -0.25rem 0 rgba(0,0,0,0.75));
}
.postage.isrezed {
  box-shadow: -0.25rem 0.25rem 0  rgba(255, 255, 255, 0.5),
   0.25rem 0.25rem 0  rgba(255, 255, 255, 0.5),
    0.25rem 0.25rem 0 rgba(0, 255, 0, 0.5),
    -0.25rem 0.25rem 0 rgba(0, 255, 0, 0.5);
}

.postage.issystem, .postage.issystem:active {
  filter: sepia(1) hue-rotate(200deg)
    drop-shadow(0.25rem 0.25rem 0 rgba(255, 255, 255, 0.404))
    drop-shadow(-0.25rem -0.25rem 0 rgba(255, 255, 255, 0.404));
}

</style>