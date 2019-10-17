<script>
import { onMount } from 'svelte';

const SIZE = 16
const SPACING = 1
const COLUMNS = 32
const COUNT = 1024

const random = (min, max) => 
    Math.floor(Math.random() * (Math.abs(min) + Math.abs(max)) - Math.abs(min))


const ready = new Promise((resolve) => {
    const tiles = new Image()
    tiles.src = "/sheets/default.png"

    tiles.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = tiles.width
        canvas.height = tiles.height

        const ctx = canvas.getContext("2d")
        ctx.drawImage(tiles, 0, 0)

        resolve({ctx, canvas})
    };
})

// example Data
// 55 55 55 55 55
// 55 55 55 55 55
export let data = ""
export let width = 10
export let height = 7
export let spacing = 0

let image;

const randomize = (data_ctx, canvas) => {
    let t_x, t_y
    let s_x, s_y

    for(let x = 0; x < width; x++) {
        for(let y = 0; y < height; y++) {
            t_x = x * SIZE 
            t_y = y * SIZE
            
            s_x = random(0, COLUMNS) * (SIZE + SPACING)
            s_y = random(0, COUNT / COLUMNS) * (SIZE + SPACING)

            data_ctx.drawImage(
                canvas, 
                s_x, s_y, SIZE, SIZE, 
                t_x, t_y, SIZE, SIZE
            )
        }
    }
}

onMount(async () => {
    const { canvas } = await ready

    const data_canvas = document.createElement("canvas")
    const data_ctx = data_canvas.getContext("2d")
    
    data_canvas.width = SIZE * width
    data_canvas.height = SIZE * height

    if(data.length > 0) {
        try {
            let x = 0
            let y = -1

            data.split("\n").forEach((row) => {
                x = -1
                y += 1

                if(y >= height) {
                    console.error("Data exceeded height")
                    return
                }

                row.split(" ").forEach((loc) => {
                    x += 1
                    if(x >= width) {
                        return console.error("Data exceeded width")
                    }

                    let idx = parseInt(loc, 10)
                    let o_x = idx % COLUMNS 
                    let o_y = Math.floor(idx / COLUMNS)

                    let t_x = x * SIZE 
                    let t_y = y * SIZE
                    
                    let s_x = o_x * (SIZE + SPACING)
                    let s_y = o_y * (SIZE + SPACING)

                    data_ctx.drawImage(
                        canvas, 
                        s_x, s_y, SIZE, SIZE, 
                        t_x, t_y, SIZE, SIZE
                    )
                })
            })
        } catch (ex) {
            console.log(`Error parsing data ${data}`)
        }
    } else {
        randomize(data_ctx, canvas)
    }

    image.src = data_canvas.toDataURL("image/png")
})
</script>

<img
    class="tileset" 
    alt="tileset image"
    bind:this={image} 
/>

<style>
.tileset {
    flex: 1;
    max-width: 100%;
    pointer-events: none;
}

</style>