import test from "ava"
import { Weave, IWeave } from "./index"
import { EWarp } from "src/warp"

test("weave/", t => {
    const data: IWeave = {
        name: "test",
        value: {
            foo: { type: EWarp.SPACE, value: {} },
            test: { type: EWarp.SPACE, value: {} }
        },

        
        wefts: {
            foo: "test"
        },
        rezed: [
            "foo"
        ]
    }

    const weave = new Weave(data)

    t.deepEqual(data, weave.toJSON())

    weave.removes("foo", "test")
    
    t.snapshot(weave.toJSON())

    weave.add({
        foo: { value: {}},
        bar: { type: EWarp.SPACE, value: {}}
    })

    t.snapshot(weave.toJSON())

    weave.add({
        foo: { value: {} }
    })
    
    t.snapshot(weave.toJSON())

    weave.destroy()
    t.snapshot(weave.toJSON())
})  


