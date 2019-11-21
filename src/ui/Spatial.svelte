<script>
import {scale as scaling} from "../sys/screen.js";

export let position = [0, 0, 0];
export let anchor = [50, 50];
export let bias = [50, 50];
export let area = [1, 1];
export let scale = 1;
export let rotate = 0;
export let autoscale = true;
export let zIndex = 0;
export let transition = true;

$: offset = [
  ((bias[0] * 0.01 * area[0]) / 2) * (anchor[0] <= 50 ? -1 : 1),
  ((bias[1] * 0.01 * area[1]) / 2) * (anchor[1] <= 50 ? -1 : 1)
];

$: tru_scale = autoscale ? scale * $scaling : scale;
$: transform = `transform: translate(${position[0] +
  offset[0]}px, ${position[1] +
  offset[1]}px) rotate(${rotate}deg) scale(${tru_scale});`;

$: anchor = [
  anchor[0] <= 50 ? `left: ${anchor[0]}%;` : `right: ${100 - anchor[0]}%;`,
  anchor[1] <= 50 ? `top: ${anchor[1]}%;` : `bottom: ${100 - anchor[1]}%;`
].join(` `);

$: tru_zIndex = `z-index: ${Math.max(1, Math.round(scale * 100 + zIndex))};`;

$: style = [tru_zIndex, anchor, transform].join(` `);
</script>

<div class="spatial" class:transition {style}>
    <slot />
</div>

<style>
.spatial {
  display: flex;
  flex-direction: column;
  position: absolute;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.spatial.transition {
  transition: transform 250ms linear;
}
</style>
