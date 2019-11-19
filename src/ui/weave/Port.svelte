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
  class="port"
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
  border-radius: 3rem;
  border: 0.25rem solid black;
  background-color: blue;
  transition:all 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275)
}

.writable {
  background-color: red;
}

.name {
  background-color: gray;
  border-radius:0.5rem;
}

.port:hover {
  background-color: green;
  box-shadow: 0 0 1rem green;
}
</style>