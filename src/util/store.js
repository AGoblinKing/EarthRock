import { writable, readable, derived as d, get as val } from "svelte/store"

const json = (store) => {
  store.toJSON = () => get(store)
  store.poke = () => store.set(get(store))

  return store
}

export const get = (thing) => is(thing)
  ? val(thing)
  : thing

export const is = (thing) => typeof thing.subscribe === `function`

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

export const derived = d
