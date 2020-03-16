import test from "ava"
import { Buffer } from "src/store"


test("store/buffer", t => {
    const buffer = new Buffer({
        test: [1, 2],
        2: [3, 4]
    }, 3)

    t.snapshot(buffer.toJSON())

    const [item, idx] = buffer.allocate({test: [0, 1]})
    
    t.snapshot(buffer.toJSON())
    t.snapshot(item.test.get())

    const test = item.test.get()
    test[0] = 5
    item.test.notify()

    t.snapshot(buffer.toJSON())

    buffer.free(0)
    t.snapshot(buffer.toJSON())

    const [view, cursor] = buffer.allocate({test: [1, 2]})
    t.snapshot(view, "allocates a view")

    view.test.set([5, 6])
    t.snapshot(view, "is setable")

    buffer.allocates({test: [3, 4]}, {test: [5, 6]}, {test: [7, 9]})

    t.snapshot(buffer.toJSON(), "allocates works, and resizes")

    buffer.resize()
    t.snapshot(buffer.toJSON(), "resizeable")

    buffer.hydrate({
        test: [50, 60],
        2: [50, 60]
    })

    t.snapshot(buffer.toJSON(), "hydratable")
})
