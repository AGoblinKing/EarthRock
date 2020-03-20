<script>
import Github from "./Github.svelte"
import Isekai from "./Isekai.svelte"
import is from "./is"

let hidden = is.sys.query("path", "flag").get() === "dev"
const button = is.sys.query("input","button")

$: {
    if($button === "`") {
        hidden = !hidden
    }
}
</script>


<div class:hidden class="dev">
    <Github />
    <Isekai />
</div>


<style>
.dev { 
    transition: opacity 250ms ease-out;
}

.hidden {
    pointer-events: none;
    opacity: 0;
}
</style>
