<script>
import border from "/ui/action/border.js"
import color from "/ui/action/color.js"

export let channel

$: [key, value] = channel
</script>

<div 
  class="channel"
  use:border
  use:color={key}
>
  <div class="key">
    {key}
  </div>
  <div class="value">
    {JSON.stringify($value)}
  </div>
</div>
<style>

.channel {
  display: flex;
  font-size: 0.75rem;
  overflow: hidden;
  margin-left: 2rem;
  padding: 0.5rem;
}
.key {
  border-right: 0.25rem solid rgb(224, 168, 83);
  padding-right: 0.25rem;
  margin-right: 0.2rem;
}

.value {
  flex: 1;
}

.channel:hover {
  background-color: #111 !important;
}
</style>