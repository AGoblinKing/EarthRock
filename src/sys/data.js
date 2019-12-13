import { tick } from "/sys/time.js"
import { path } from "/sys/path.js"
import { load } from "/sys/file.js"

const VERSION = 3
const HOUR_AGO = IDBKeyRange.upperBound(Date.now() - 1000 * 60 * 60)
let db

let load_res
export const loaded = new Promise((resolve) => { load_res = resolve })
export const data = new Promise((resolve) => {
  const req = window.indexedDB.open(`isekai`, VERSION)

  req.onupgradeneeded = async (e) => {
    db = e.target.result

    db.createObjectStore(`wheel`, { keyPath: `date` })

    resolve(db)
  }

  req.onsuccess = (e) => {
    db = e.target.result

    resolve(db)
  }
})

export const query = ({
  store = `wheel`,
  action = `get`,
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
  const wheel = Wheel.toJSON()

  wheel.date = Date.now()

  // update current
  await query({
    action: `put`,
    args: [wheel]
  })
}

export const clean = () => query({
  action: `delete`,
  args: [HOUR_AGO]
})

window.query = query

const init = async () => {
  const result = await query({
    action: `getAll`
  }).catch((e) => console.warn(`DB`, e.target.error))

  if (result && result.length > 0) {
    const { weaves, running } = result.pop()
    delete weaves[Wheel.SYSTEM]

    Wheel.spawn(weaves)

    Object.keys(running).forEach((id) => {
      if (id === Wheel.SYSTEM) return
      if (!Wheel.get(id)) return
      Wheel.start(id)
    })
  }

  load_res(true)

  tick.listen((t) => {
    if (
      t % 10 !== 0 ||
      db === undefined ||
      !loaded
    ) return

    save()
    if (t % 100 === 0) clean()
  })
}

init()

path.listen(async ($path) => {
  if ($path.length < 3) return
  const url = `https://raw.githubusercontent.com/${$path[0]}/${$path[1]}/master/${$path[2]}.jpg`

  const reader = new FileReader()
  const blob = await fetch(url)
    .then((r) => r.blob())

  reader.readAsDataURL(blob)

  reader.addEventListener(`load`, () => {
    const data = load(reader.result)
    if (!data) return

    Wheel.spawn({
      [data.name]: data
    })

    Wheel.start(data.name)
  })
})
