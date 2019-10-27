import {derived, writable} from "svelte/store"
import scaling from "./scaling.js"

export const Grid = ({
    spacing = 10,
    columns = 3
} = false) => derived(scaling, 
    ($scaling, set) => {

        set((item, i) => ([
            Math.round(i % columns * spacing * $scaling), 
            Math.round(Math.floor(i/columns) * spacing * $scaling)
        ]))
    }
       
)
 
export const Circle = ({
    max = 9,
    radius = 50,
    offset = 0,
    wobble = [ 0.5, 20 ],

} = false) => ({i, scale}) => {
        const angle = i / max * 2 * Math.PI 
        const tru_radius = scale * (radius + Math.sin(i + wobble[0]) * wobble[1] )
    
        return [
            tru_radius * Math.cos(angle),
            tru_radius * Math.sin(angle)
        ]
    }

    

export const Triangle = ({
    max = 9,
    radius = 100,
    offset = 0
}) => derived(scaling, ($scaling, set) => {
    set((item, i) => ([

    ]))
})