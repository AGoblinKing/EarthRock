<script lang="typescript">
import Github from "./Github.svelte"

import { Isekai } from "src/isekai"
import { button } from "./sys/input"

export let isekai: Isekai
let hidden = true

$: {
    if($button === "`") {
        hidden = !hidden
    }
}

</script>

<template type="text/pug">
+if('!hidden')
    Github
</template> 

<style type="text/stylus">
.hello
    color white
</style>
