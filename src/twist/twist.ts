import { IStore, Store, Tree, ProxyTree, Living } from "src/store"
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

    static map_to_stores (twist_data: object) {
        const stores = {}

        for(let key of Object.keys(twist_data)) {
            stores[key] = new Store(twist_data[key])
        }

        return stores
    }
    
    constructor (weave: Weave, space: Space) {
        super()

        this.space = space
        this.weave = weave
        this.value = new Tree({})
    }

    toJSON() {
        return this.value.toJSON()
    }

}
