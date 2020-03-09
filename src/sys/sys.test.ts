import test from "ava"
import * as sys from "src/sys"
import raf from "raf"

test("sys/time", t => {
    t.snapshot(sys)

    raf(() => {
        t.snapshot(sys.TIME.tick)
    })

    return new Promise(resolve => setTimeout(() => {
        t.snapshot(sys.TIME.tick)
        resolve()
    }, 101))
})

