<script>
import { draw } from "svelte/transition"
import { linear } from "svelte/easing"
</script>

<svg viewBox="-5 -5 110 110" class="svg">
  <path	stroke="rgba(0, 0, 0, 0.5)"
  d={[
  `M0 50 L15 15 L50 0 L85 15 L100 50 L85 85 L50 100 L 15 85 L0 50`,
  `M15 85 Q25 50, 50 50 T 85 15`,

  `M15 85 Q50 75, 50 50 T 85 15`,

  `M15 15 Q25 50, 50 50 T 85 85`,
  `M15 15 Q50 25, 50 50 T 85 85`
].join(` `)}
/>
<path 
d={[
  `M0 50 Q0 0,50 0 Q 100 0, 100 50 Q 100 100, 50 100 Q 0 100, 0 50`,

  `M0 50 Q25 75, 50 50 T 100 50`,

  `M50 0 Q25 25, 50 50 T 50 100`,

  `M0 50 Q25 25, 50 50 T 100 50`,
  `M50 0 Q75 25, 50 50 T 50 100`

].join(` `)}
/>

<circle cx="15" cy="15" r="4" stroke="black"  fill="black" />
<circle cx="15" cy="85" r="4" stroke="black"  fill="black" />
<circle cx="85" cy="85" r="4" stroke="black"  fill="black" />
<circle cx="85" cy="15" r="4" stroke="black"  fill="black" />

<circle cx="0" cy="50" r="4" stroke="white" fill="white"/>
<circle cx="50" cy="0" r="4" stroke="white" fill="white"/>
<circle cx="100" cy="50" r="4"   stroke="black"  fill="black"/>
<circle cx="50" cy="100" r="4"   stroke="black"  fill="black"/>

</svg>

<style>
.svg {
    flex: 1;
    stroke: black;
    stroke-width: 1;

    stroke-linejoin: round;
    stroke-linecap: round;
    fill: none;
    filter: drop-shadow(0 0 0.5rem white);
    opacity: 0.25;
}

@keyframes dash {
  to {
    stroke-dashoffset: -100;
  }
}
</style>