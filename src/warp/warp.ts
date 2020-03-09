import { NAME, EWarp, WarpJSON } from "src/weave/types"
import { Weave } from "src/weave/weave"
import { IStore, Listener, Proxy } from "src/store"

export abstract class Warp<T> extends Proxy<T> {
    readonly name: NAME
    readonly type: EWarp

    protected weave: Weave
    protected value: IStore<T>

    constructor(data: WarpJSON<any>, weave: Weave) {
        super()

        this.name = data.name
        this.type = data.type
        this.weave = weave

        // don't init value because who knows what they want
    }

    toJSON(): WarpJSON<T> {
        return {
            name: this.name,
            type: this.type,
            value: this.value.toJSON()
        }
    }
}
