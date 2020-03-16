import test from "ava"
import { Transformer } from "./transformer"

test("store/transformer", t => {
    const store = new Transformer(1, (i) => i + 1)

    t.snapshot(store.get())
    store.set(5)

    t.snapshot(store.get())
})
