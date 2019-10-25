<script>
import scaling from "../scaling.js"

export let position = [0, 0]
export let anchor = [50, 50]
export let bias = [50, 50]
export let area = [1, 1]
export let scale = 1
export let rotate = 0

$: offset = [
    bias[0] * .01 * area[0] / 2 * (anchor[0] <= 50 ? -1 : 1),
    bias[1] * .01 * area[1] / 2 * (anchor[1] <= 50 ? -1 : 1)
]

$: transform = `transform: translate(${position[0] + offset[0]}px, ${position[1] + offset[1]}px) rotate(${rotate}deg) scale(${scale * $scaling});`

$: anchor = [
    (anchor[0] <= 50 ? `left: ${anchor[0]}%;` : `right: ${100 - anchor[0]}%;`),
    (anchor[1] <= 50 ? `top: ${anchor[1]}%;` : `bottom: ${100 - anchor[1]}%;`)
].join(" ")

$: zIndex = `z-index: ${Math.round(scale * 100)};` 

$: style = [zIndex, anchor, transform].join(" ")

</script>

<div class="spatial" {style}>
    <slot />
</div>

<style>
.spatial {
    z-index: 2;
    position: absolute;
    perspective: 1000px;
    transition: transform 0.42s cubic-bezier(0.68, -0.25, 0.265, 1.5);
}
</style>