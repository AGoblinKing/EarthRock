import test from "ava"
import { Wheel } from "./wheel"
import { simple } from "./test.data"

test("wheel/", t => {
    const wheel = new Wheel(simple)

    t.snapshot(wheel.toJSON(), "loads")
    
    
})