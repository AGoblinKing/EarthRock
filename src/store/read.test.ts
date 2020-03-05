import test from "ava"
import { Read } from "./read"

test("store/read", t => {
    t.plan(3)
    let setter
    const read = new Read(5, set => {
        setter = set
    })

    const cancel = read.listen(($value) => {
        t.true($value === 10)
        cancel()
    }, true)

    t.snapshot(read.get())
    read.set(6)
    t.snapshot(read.get())

    setter(10)
})