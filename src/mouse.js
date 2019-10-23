import {writable, get} from "svelte/store"

const mouse_pos = writable([0, 0])
const mouse_raw = [0, 0]

window.addEventListener("mousemove", (e) => {
    mouse_raw[0] = e.clientX
    mouse_raw[1] = e.clientY


    if(mouse_raw[0] !== get(mouse_pos)[0] || mouse_raw[1] !== get(mouse_pos)[1]) {
        mouse_pos.set([...mouse_raw])
    }
})


export default mouse_pos
