import { writable, readable, get } from "svelte/store"

const VERSION = 1

let db

const init = async () => {
  weave.set(await query({
    action: `getAll`
  }))

  query({
    store: `flags`
  })
}

export const flags = writable()

export const name = writable({
  // [alias]: uuid
})

export const trash = writable({})

export const weave = writable({
  // [uuid]: writable({... weave stuff})
})

export const ready = readable(false, set => {
  const req = window.indexedDB.open(`isekai`, VERSION)

  req.onupgradeneeded = ({ event: { target: result } }) => {
    db = result

    db.createObjectStore(`weave`, { keyPath: `id` })
    db.createObjectStore(`trash`, { keyPath: `id` })

    init()
    set(true)
  }

  req.onsuccess = ({ event: { target: result } }) => {
    db = result
    init()
    set(true)
  }
})

const { set } = weave

const query = ({
  store = `weave`,
  action = `get`,
  args = []
}) => new Promise((resolve, reject) => {
  const t = db.transaction([store, `readwrite`])
  t.onerror = reject
  t.objectStore(store)[action](...args).onsuccess = resolve
})

weave.set = (weaves_data) => {
  const ws = get(weave)
  const ns = get(name)

  const add_weave = (weave) => {
    const weave_w = ws[weave.id] = writable({})
    ns[weave.name] = weave.id
    const { set: weave_set } = weave_w

    weave_w.set = (data) => {
      // db transactions

      weave_set(data)
    }

    weave_w.set(weave)
  }

  const delete_weave = ({ id, name }) => {
    const [ws, ns] = [get(weave), get(name)]

    delete ns[name]
    delete ws[id]

    // db transaction, its okay for these to be laggy

    name.set(ns)
    set(ws)
  }

  const update_weave = (weave) => {
    const ws = get(weave)
    const ns = get(name)

    const { name: old_name } = get(ws[weave.id])
    ws[weave.id].set(weave)

    if (old_name !== weave.name) delete ns[old_name]

    ns[weave.name] = weave.id
    name.set(ns)
  }

  Object.entries(weaves_data).forEach(
    ([id, weave]) =>
      !ws[id]
        ? add_weave(weave)
        : weave === undefined
          ? delete_weave(weave)
          : update_weave(weave)
  )

  // bulk transaction
  set({
    ...ws
  })

  name.set(ns)
}
