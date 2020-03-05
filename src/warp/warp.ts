import { ID, EWarp, WarpJSON } from "src/weave/types"
import { Weave } from "src/weave/weave"
import { IStore, Listener, Proxy } from "src/store"

export abstract class Warp<T> extends Proxy<T> {
    readonly id: ID
    readonly type: EWarp

    protected weave: Weave
    protected value: IStore<T>

    constructor(data: WarpJSON<any>, weave: Weave) {
        super()

        this.id = data.id
        this.type = data.type
        this.weave = weave

        // don't init value because who knows what they want
    }

    toJSON(): WarpJSON<T> {
        return {
            id: this.id,
            type: this.type,
            value: this.value.toJSON()
        }
    }
}
