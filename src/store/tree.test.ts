import test from "ava"

import { Tree } from "./tree"
import { Store } from "./store"

test("store/tree", t => {
    const tree = new Tree({
        foo: 1,
        bar: "2",
        store: new Store(5),
        stores: new Store(new Store("string"))
    })

    t.snapshot(tree.get())
})

test("store/tree/names", t => {
    const tree = new Tree({
        foo: 1,
        bar: "2",
        store: new Store(5),
        stores: new Store(new Store("string"))
    })

    tree.write({foo: 2})
    t.snapshot(tree.get())
    t.snapshot(tree.get_name("foo"))


    tree.write({
        foo: 5,
        store: 1,
        new_thing: "new"
    })

    t.snapshot(tree.get())
    t.snapshot(tree.toJSON())
})

