import test from "ava"
import { Store } from "./store"
import raf from "raf"

test("store/store", t => {
    const s = new Store(5)
    t.snapshot(s.get())

    s.set(6)
    t.snapshot(s.get())

    s.update((i) => i + 1)
    t.snapshot(s.get())
})

test("store/observable", async t => {
    const s = new Store(6)

    await new Promise((resolve) => {
        t.plan(1)

        const cancel = s.subscribe(($value) => {
            t.snapshot($value)

            raf(() => {
                cancel()
                s.set(7)
                resolve()
            })
        })
    })
})

test("store/listen/silent", async t => {
    const s = new Store(6)

    await new Promise((resolve) => {
        t.plan(1)

        const cancel = s.listen(($value) => {
            t.snapshot($value)
            cancel()
            resolve()
        }, true)

        s.set(7)
    })
})

test("store/toJSON", t => {
    t.snapshot(new Store({"foo": "bar"}).toJSON())
    t.snapshot(new Store(5).toJSON())
    t.snapshot(new Store([5, 5]).toJSON())
    t.snapshot(new Store(new Store(5)).toJSON())
})

test("store/set/silent", t => {
    t.plan(1)
    const store = new Store(5)
    store.listen(($value) => {
        t.pass()
    }, true)

    store.set(6, true)
    store.set(7)
})

