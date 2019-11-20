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
