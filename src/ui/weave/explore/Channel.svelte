<script>
import color from "/ui/action/color.js"

export let channel

$: [key, value] = channel
</script>

<div 
  class="channel"
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
  border-left: 0.25rem solid #333;
  border-bottom: 0.25rem solid #333;
}
.key {
  border-right: 0.25rem solid white;
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