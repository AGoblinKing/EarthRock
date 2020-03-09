import { Twist } from "./twist"
import { Weave } from "src/weave"
import { Tree } from "src/store"
import { Space } from "src/warp"

export class Data extends Twist<any>  {
    constructor(weave: Weave,  space: Space, data: object) {
        super(weave, space)
        this.write(Twist.map_to_stores(data))
    }
}
