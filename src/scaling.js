import {writable} from "svelte/store"

const scaling = writable(1)

const scale = () => {
    const [ width, height ] = [window.innerWidth, window.innerHeight]

    const target = width > height ? height : width
    // try to peg 10 cards always\
    // ^ well that is a lie. magic numbers below
    scaling.set(target/(500 * 2))
}

window.addEventListener("resize", scale)

scale()
export default scaling