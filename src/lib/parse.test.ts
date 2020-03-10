import test from "ava"

import {json} from "./parse"

test("lib/parse", t => {
    t.snapshot(json("5"))
    t.snapshot(json("5.9"))
    t.snapshot(json("hello"))
    t.snapshot(json("[5]"))
    t.snapshot(json("{\"5\": 5}"))
})