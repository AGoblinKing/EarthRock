import { tick } from "/sys/time.js"

const VERSION = 2

let db

let load_res
export const loaded = new Promise((resolve) => { load_res = resolve })
export const data = new Promise((resolve) => {
  const req = window.indexedDB.open(`isekai`, VERSION)

  req.onupgradeneeded = async (e) => {
    db = e.target.result

    db.createObjectStore(`weave`, { keyPath: `id` })
    db.createObjectStore(`running`, { keyPath: `id` })

    resolve(db)
  }

  req.onsuccess = (e) => {
    db = e.target.result

    resolve(db)
  }
})

export const query = ({
  store = `weave`,
  action = `getAll`,
  args = [],
  foronly = `readwrite`
} = false) => new Promise((resolve, reject) => {
  data.then(() => {
    const t = db.transaction([store], foronly)
    t.onerror = reject
    t.objectStore(store)[action](...args).onsuccess = (e) => resolve(e.target.result)
  })
})

export const save = async () => {
  const {
    running, weaves
  } = Wheel.toJSON()

  await Promise.all([
    query({
      action: `clear`
    }),
    query({
      store: `running`,
      action: `clear`
    })
  ])

  await Promise.all([
    ...Object.values(weaves).map((data) => query({
      action: `put`,
      args: [data]
    })),
    ...Object.keys(running).map((id) => query({
      store: `running`,
      action: `put`,
      args: [{
        id
      }]
    }))
  ])
}

tick.listen((t) => {
  if (
    t % 10 !== 0 ||
    db === undefined ||
    !loaded
  ) return

  save()
})

window.query = query

const init = async () => {
  const [
    weaves,
    running
  ] = await Promise.all([
    await query(),
    await query({
      store: `running`
    })
  ])

  Wheel.spawn(Object.fromEntries(
    weaves
      .filter((w) => w.name !== Wheel.SYSTEM)
      .map((w) => [
        w.name,
        w
      ])
  ))

  running.forEach((r) => {
    if (r.id === Wheel.SYSTEM) return

    Wheel.start(r.id)
  })

  load_res(true)
}

init()
