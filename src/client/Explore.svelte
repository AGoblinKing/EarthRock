<script lang="typescript">
import { Wheel } from "src/wheel"

export let wheel: Wheel

</script>

<template lang="pug">
+if('$wheel')
	.explore
		+each('Object.entries($wheel) as [weave, name]')
			.name {name}
</template>

<style lang="stylus">
.explore
	position absolute
	align-items center
	font-size 1.25rem
	scrollbar-color #333
	scrollbar-width 1rem
	scroll-behavior smooth
	overflow-y auto
	left 0
	right 0
	top 0
	bottom 0
	display flex
	flex-direction column
	z-index 5

.name
	color #00F

</style>