
import { Twist } from "./twist"
import { Weave } from "src/weave"

export interface IPhysical {
     
}

export class Physical extends Twist {
    constructor(weave: Weave,  visible_data: IPhysical) {
        super(weave, visible_data)
    }
}