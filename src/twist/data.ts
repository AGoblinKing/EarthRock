import { Twist } from "./twist"
import { Weave } from "src/weave"
import { Tree } from "../store"

export class Data extends Twist  {
    constructor(weave: Weave,  data: object) {
        super(weave, data)
    }
}
