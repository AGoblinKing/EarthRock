import { Twist } from "./twist"
import { Weave } from "src/weave"
import { Space } from "src/warp"

export class Data extends Twist<any>  {
    constructor(weave: Weave,  space: Space, data: object) {
        super(weave, space)
        this.add(data)
    }
}
