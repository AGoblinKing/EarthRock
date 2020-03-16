import test from "ava"
import { Goblin } from "./goblin"
import { Tree, Store } from "src/store"
import * as time from "src/sys/time"

import { simple } from "../wheel/test.data"

time.TIME_TICK_RATE.set(10)

test("goblin/", async t => {
    const worker = new Goblin(new Tree({
        test: new Tree({
            1: new Store(5)
        }),
        time: new Tree(time)
    }), true)

    worker.create()
    worker.rez()

    t.snapshot(worker)
    t.snapshot(worker.toJSON())

    worker.remote_add(simple)

    t.snapshot(await worker.remote_toJSON())

    let count = 0

    await new Promise(resolve => {
        const cancel = worker.listen($buffer => {
            t.snapshot($buffer.VISIBLE.toJSON())

            if(count++ < 4) return
            cancel()
            resolve()
        })
    })
})
