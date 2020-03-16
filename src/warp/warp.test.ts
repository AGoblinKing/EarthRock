import test from "ava"

import { Weave, IWeave } from "src/weave"

test("warp/", t => {
    const weave = new Weave({
        name: "test",
        value: {
            hello: {
                value: {VISIBLE: {
                    sprite: [5]
                }}
            }
        },
        thread: {},
        rezed: []
    })

    const { hello } = weave.value.get()
    t.snapshot(hello.toJSON())
    weave.destroy()
})

