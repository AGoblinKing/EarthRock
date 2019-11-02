<script>
    import color from '/action/color.js'
    import Port from "./Port.svelte"
    
    export let hole
    
    $: value = hole.value
    $: math = hole.math
    $: error = $value === undefined
    </script>
    
    <div class="box">
      <Port writable address={`${hole.id}|write`} />
      <div class="middle" use:color={$value}>
        <input type="text" bind:this={$math} />
        <div>{$value}</div>
      </div>
      <Port address={`${hole.id}|read`} />
    </div>
    
    <style>
    .box {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    
    </style>