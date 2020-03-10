import test from "ava"
import * as sys from "src/sys"

test("sys/time", t => {
    t.snapshot(sys)

    return new Promise(resolve => setTimeout(() => {
        t.snapshot(sys.TIME.tick)
        resolve()
    }, 101))
})
