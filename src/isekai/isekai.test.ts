import test from "ava"
import { Isekai } from "src/isekai"
import { Store } from "../store"
import { simple } from "src/wheel/test.data"
import * as time from "src/sys/time"

test("isekai/", t => {
    const isekai = new Isekai({
        test: {
            there: new Store(1)
        },
        time
    }, true)

    t.snapshot(isekai.toJSON(), "base snapshot")
    t.snapshot(isekai.sys.query("test", "there").get())

    isekai.add({ simple })

    t.snapshot(isekai)
})
