import { Twist } from "src/twist/twist"
import { Weave } from "src/weave/weave"
import { Space } from "src/warp/space"
import { Buffer } from "src/store"

export interface IVisible {
    sprite?: Array<number>,
    position?: Array<number>,
    color?: Array<number>,
    rotation?: Array<number>,
    scale?: Array<number>
}

// Visible spaces
export class Visible extends Twist<Float32Array> { 
    static defaults = { 
        position: [0, 0, 0],
        sprite: [0],
        scale: [1],
        color: [255, 255, 255, 1],
        rotation: [0]
    }

    static data = new Buffer(Visible.defaults)

    protected index: number

    constructor(weave: Weave, space: Space, visible_data: IVisible) {
        // set the views
        super(weave, space)
        const [view, idx] = Visible.data.allocate(visible_data)
        this.index = idx
        this.write(view)
    }

    toJSON() {
        const json = {}
        const $value = this.get()
        for(let key of Object.keys($value)) {
            const $item = $value[key].get()

            json[key] = Array.from($item)
        }

        return json
    }
}