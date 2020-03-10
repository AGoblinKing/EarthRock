import test from "ava"
import { Living } from "./living"
import { Tree } from "./tree"
import { Store } from "./store"

class Test extends Living<Test> {
    constructor(count: number) {
        super()
        
        const $value = {}
        for(let i = 0; i < count; i++) {
            $value[`${i}`] = new Test(0)
        }

        this.value = new Tree($value)
        this.rezed = new Store(new Set(["1"]))
    }
}

test("store/living", t => {
    const tester = new Test(5)

    t.snapshot(tester)

    tester.create()

    t.snapshot(tester)

    tester.add({
        6: new Test(1)
    })

    t.snapshot(tester.toJSON())

    tester.remove("2")
    t.snapshot(tester)

    tester.start("6")

    t.snapshot(tester)

    tester.query("6").start("0")
    tester.rez()

    t.snapshot(tester)

    tester.derez()
    t.snapshot(tester)

    tester.start("0")
    tester.stop("6")

    tester.rez()

    t.snapshot(tester)

    tester.remove("0")
    t.snapshot(tester)

    tester.destroy()

    t.snapshot(tester)

    tester.create()
    tester.rez()

    t.snapshot(tester)

    t.snapshot(tester.query("6", "0"))
})