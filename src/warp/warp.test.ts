import test from "ava"

import { Weave, IWeaveJSON } from "src/weave"
import {  Store } from "src/store"
import { Space } from "./space"

test("warp/", t => {
    const weave = new Weave({
        name: "test",
        warps: {
            hello: {
                value: {VISIBLE: {
                    sprite: [5]
                }}
            }
        },
        wefts: {},
        rezed: []
    } as IWeaveJSON)

    const { hello } = weave.warps.get()
    t.snapshot(hello.toJSON())
    weave.destroy()
})

test("warp/space", t => {
    const weave = new Weave({
        name: "test",
        warps: {
            hello: {
                value: {VISIBLE: {
                    sprite: [5]
                }}
            }
        },
        wefts: {},
        rezed: []
    } as IWeaveJSON)

    const hello = weave.warps.get().hello as Space

    hello.write({ DATA: { foo: 5 } })
    t.snapshot(hello.toJSON())

    const vis = hello.item("VISIBLE")
    t.snapshot(vis.toJSON())
    vis.write({
        foo: new Store(5) 
    })

    t.snapshot(vis.get())

    weave.
})