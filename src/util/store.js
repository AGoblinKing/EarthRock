const writable = (val) => {
  const subs = new Set()

  const w = {
    get: () => val,
    poke: () => {
      w.set(w.get())
      return w
    },
    set: (val_new) => {
      val = val_new
      subs.forEach((fn) => fn(val))
      return w
    },
    update: (fn) => {
      w.set(fn(val))
      return w
    },
    subscribe: (fn) => {
      subs.add(fn)
      fn(val)
      return () => subs.delete(fn)
    }
  }

  w.toJSON = w.get
  w.listen = w.subscribe

  return w
}

const readable = (val, handler) => {
  const w = writable(val)
  const { set } = w
  w.set = () => console.warn(`tried to write to readable`)
  w.readonly = true
  if (handler) handler(set)
  return w
}

export const write = (thing) => writable(thing)
export const read = (thing, handler) => readable(thing, handler)

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

export const listen = (subs, fn) => {
  const call = () =>
    fn(subs.map((s) => s.get()))

  const cancels = subs.map((store) => store.subscribe(call))
  return () => cancels.forEach(fn => fn())
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

export const derived = (stores, fn) => readable(undefined, (set) => {
  stores = Array.isArray(stores)
    ? stores
    : [stores]

  const cancels = stores.map(
    (store) =>
      store.listen(() =>
        set(fn(stores.map((s) => s.get())))
      )
  )
})
