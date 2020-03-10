
import { Twist } from "./twist"
import { Weave } from "src/weave"
import { Space } from "src/warp"

export interface IPhysical {
     
}

export class Physical extends Twist<any> {
    constructor(weave: Weave,  space: Space, physical_data: IPhysical = {}) {
        super(weave, space)
        this.add(Twist.map_to_stores(physical_data))
    }
}