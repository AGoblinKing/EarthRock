import { write, read } from "/util/store.js"

// instead use the weave messaging channel
export default ({
  whom = `/sys/mouse/position`,
  weave,
  id,
  life
}) => {
  const value = write()
  const { set } = value

  const fix = (address) => address
    .replace(`$`, ``)
    .replace(`~`, `/${weave.name.get()}`)
    .replace(`.`, weave.to_address(weave.chain(id, true).shift()))

  // when set hit up the remote
  value.set = (value_new) => {
    const $whom = fix(m.whom.get())

    const v = Wheel.get($whom)

    if (!v || !v.set) {
      return
    }

    v.set(value_new)

    set(value_new)
  }

  // Subscribe to remote
  const m = ({
    knot: read(`mail`),
    whom: write(whom),
    value,
    set
  })

  life(() => {
    const cancels = new Set()
    const clear = () => {
      cancels.forEach((fn) => fn())
      cancels.clear()
    }

    const cancel_whom = m.whom.listen(($whom) => {
      clear()

      $whom = $whom
        .replace(`.`, weave.to_address(weave.chain(id, true).shift()))
        .replace(`~`, weave.name.get())

      if ($whom[0] === `$`) {
        $whom = $whom.replace(`$`, ``)
        const thing = Wheel.get($whom)
        if (!thing) return set(null)

        set(thing.get())
        return
      }

      let thing = Wheel.get($whom)
      if (!thing) return set(null)
      thing = thing.value
        ? thing.value
        : thing

      cancels.add(thing.listen(($thing) => {
        set($thing)
      }))
    })

    return () => {
      cancel_whom()
      clear()
    }
  })
  return m
}
