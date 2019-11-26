import { writable, readable, derived as d, get as val } from "svelte/store"

const json = (store) => {
  store.get = () => val(store)
  store.toJSON = () => val(store)
  store.poke = () => store.set(val(store))
  store.listen = store.subscribe
  store.set = store.set || (() => {})
  return store
}

export const write = (thing) => json(writable(thing))
export const read = (thing, handler) => json(readable(thing, handler))

export const set = (store, value) => {
  store.set(value)

  return store
}

export const transformer = (transform) => {
  const store = write()

  const set = store.set
  store.set = (update) => {
    set(transform(update))
    return store
  }

  return store
}

export const derived = (...args) => json(d(...args))

export const listen = (subs, fn) => {
  const call = () =>
    fn(subs.map((s) => s.get()))

  const cancels = subs.map((store) => store.subscribe(call))
  return () => cancels.forEach(fn => fn())
}

export const aggregate = (amount = 10) => {
  const a = write([])
  const { set } = a
  a.set = (new_value) => {
    const a_new = [new_value, ...a.get()]
  }

  return json(a)
}

export const map = (init = {}) => {
  const m = write()
  const set_m = m.set

  m.set = (data) => set_m(Object.fromEntries(
    Object.entries(data)
      .map(([key, val]) => [
        key,
        (val && typeof val.subscribe === `function`)
          ? val
          : write(val)
      ])
  ))

  m.set(init)

  return m
}
