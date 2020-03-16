import { Weave } from "src/weave/weave"
import { Living, NAME } from "src/store"

export interface IWarp<T> {
    name?: NAME
    type?: EWarp
    value: T
}

export enum EWarp {
    SPACE = "SPACE",
    MATH = "MATH",
    VALUE = "VALUE",
    MAIL = "MAIL"
}

export abstract class Warp<T> extends Living<T> {
    readonly name: NAME
    readonly type: EWarp

    protected weave: Weave

    constructor (data: IWarp<any>, weave: Weave) {
        super()

        this.name = data.name
        this.type = data.type
        this.weave = weave
        
        // don't init value because who knows what they want
    }

    toJSON (): IWarp<T> {
        return {
            name: this.name,
            type: this.type,
            value: this.value.toJSON()
        }
    }
}
