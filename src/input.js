import {writable} from 'svelte/store'

export const mouse = writable([0, 0])

window.addEventListener('mousemove', (e) => 
    mouse.set([e.clientX, e.clientY])
)

