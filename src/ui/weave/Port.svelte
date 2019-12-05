<script>
import { first, second } from "/sys/port-connection.js"

// In/out ports
export let writable = false
export let name = false

export let address = ``

const mousedown = () => {
  first.set(address)
}

const mouseup = () => {
  second.set(address)
}
</script>


<div
  class="port no-drag"
  id={address}
  class:writable
  class:name
  on:mousedown={mousedown}
  on:mouseup={mouseup}
>

</div>

<style>
.port {
  width: 2rem;
  height: 2rem;
  margin: 0.5rem;
  border: 0.25rem solid black;
  background-color: blue;
}

.writable {
  background-color: red;
}

.name {
  background-color: gray;
}

.port:hover {
  background-color: green;
  box-shadow: 0 0 1rem green;
}
</style>