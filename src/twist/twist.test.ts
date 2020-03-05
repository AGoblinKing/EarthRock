import test from "ava"
import { Weave } from "src/weave"

test("twist/visible", t => {
    const weave = new Weave({
        name: "test",
        wefts: {},
        rezed: [],
        warps: {
            test: {
                value: {
                    VISIBLE: {
                        sprite: [2]
                    }
                }
            }
        }
    })

    t.snapshot(weave.toJSON())
})

test("twist/data", t => {
    const weave = new Weave({
        name: "test",
        wefts: {},
        rezed: [],
        warps: {
            test: {
                value: {
                    DATA: {
                        arbitrary: "hello"
                    }
                }
            }
        }
    })

    t.snapshot(weave.toJSON())
})

test("twist/physical", t => {
    const weave = new Weave({
        name: "test",
        wefts: {},
        rezed: [],
        warps: {
            test: {
                value: {
                    PHYSICAL: {
                        position: [0,0,0]
                    }
                }
            }
        }
    })

    t.snapshot(weave.toJSON())
})