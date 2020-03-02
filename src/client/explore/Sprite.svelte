<script>
import { SPRITES } from "/sys/flag.js"

export let edit = true
</script>

<div class="tile">
  {#if edit}
    <img src={$SPRITES} alt="sprites"/>
  {/if}
</div>

