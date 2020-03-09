import test from "ava"
import { Weave } from "./index"
import { EWarp, IWeaveJSON } from "./types"

test("weave/", t => {
    const data: IWeaveJSON = {
        name: "test",
        warps: {
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

    weave.delete("foo", "test")
    
    t.snapshot(weave.toJSON())

    weave.write({
        foo: { value: {}},
        bar: { type: EWarp.SPACE, value: {}}
    })

    t.snapshot(weave.toJSON())

    weave.write({
        foo: { value: {} }
    })
    
    t.snapshot(weave.toJSON())

    weave.destroy()
    t.snapshot(weave.toJSON())
})  


