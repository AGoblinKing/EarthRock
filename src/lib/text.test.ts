import test from "ava"
import {  tile, random } from "src/lib/text"

test("lib/text", t => {
    t.snapshot(tile("hello"))
    t.is(typeof random(2), "string")
})