import { IStore, Store, Tree, Living } from "src/store"
import { Weave } from "src/weave/weave"
import { Space } from "src/warp/space"

export enum ETwist {
    VISIBLE = "VISIBLE",
    PHYSICAL = "PHYSICAL",
    DATA = "DATA"
}

export interface ITwist {
    [key: string]: any
}

export abstract class Twist<T> extends Living<IStore<T>> {
    protected value: Tree<IStore<T>>
    protected weave: Weave
    protected space: Space
    
    constructor (weave: Weave, space: Space) {
        super()

        this.space = space
        this.weave = weave
        this.value = new Tree({})
    }

    add (data: ITwist, silent = false) {
        const write = {}
        for(let [name, value] of Object.entries(data)) {
            if(value instanceof Store) {
                write[name] = value
            } else {
                write[name] = new Store(value)
            }
        }

        super.add(write, silent)
    }

    toJSON () {
        return this.value.toJSON()
    }
}
