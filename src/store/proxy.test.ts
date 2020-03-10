import test from "ava"

import { Proxy, ProxyTree } from "./proxy"
import { Store } from "./store"
import { Tree } from "./tree"

class TestProxy extends Proxy<number> {
    value = new Store(5)
}

class TestProxyTree extends ProxyTree<number> {
    value = new Tree({
        test: 5,
        foo: 6
    })
}

test("store/proxy", t => {
    const proxy = new TestProxy()

    t.snapshot(proxy.get())
    
    proxy.set(6)

    t.snapshot(proxy.toJSON())
})

test("store/proxy/tree", t => {
    const proxy = new TestProxyTree()

    t.snapshot(proxy.get())

    proxy.add({
        foos: 7
    })

    t.snapshot(proxy.toJSON())

    proxy.remove("foo")

    t.snapshot(proxy.get())
})
