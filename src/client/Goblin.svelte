 <script>
import is from "src/client/is"

export let goblin  = ""
const remote = is.item(goblin)

</script>

<div class="wheel">
    <div class="title">
        {goblin}
    </div>
    
</div>

<style>

.title {
   
}

.wheel {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: rgb(224, 168, 83);
}
</style>
