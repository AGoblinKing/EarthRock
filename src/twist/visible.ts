import { Twist } from "src/twist/twist"
import { Weave } from "src/weave/weave"

export interface IVisible {
    sprite: Array<number>,
    position: Array<number>,
    color: Array<number>,
    rotation: Array<number>,
    scale: Array<number>
}

export class Visible extends Twist {
    static count = 100 
    static data = Visible.create_data(100)

    static defaults = { 
        position: [0, 0, 0],
        sprite: [0],
        scale: [1],
        color: [255, 255, 255, 1],
        rotation: [0]
    }

    static create_data(size) { 
        return {
            position: new Float32Array(size * 3),
            sprite: new Float32Array(size),
            scale: new Float32Array(size),
            color : new Float32Array(size * 4)
        }
    }

    constructor(weave: Weave, visible_data: IVisible) {
        super(weave, visible_data)
    }
}