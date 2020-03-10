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

    tree.add({foo: 2})
    t.snapshot(tree.get())
    t.snapshot(tree.item("foo"))

    tree.add({
        foo: 5,
        store: 1,
        new_thing: "new"
    })

    t.snapshot(tree.get())
    t.snapshot(tree.toJSON())

    tree.remove("store")

    t.snapshot(tree.get())
})



test("store/tree/query", t => {
    const tree = new Tree({
        foo: 1,
        nest: new Tree({
            deeper: new Tree({
                final: 3
            }),
            mid: 2
        })
    })

    t.snapshot(tree.query("foo"))
    t.snapshot(tree.query("nest"))
    t.snapshot(tree.query("nest", "mid"))
    t.snapshot(tree.query("nest", "deeper"))
    t.snapshot(tree.query("nest", "deeper", "final"))
})