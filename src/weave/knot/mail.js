import { transformer, write, read } from "/util/store.js"

// instead use the weave messaging channel
export default ({
  whom = `/sys/mouse/position`,
  weave,
  id
}) => {
  const value = write()
  const { set } = value

  // when set hit up the remote
  value.set = (value_new) => {
    const v = Wheel.get(m.whom.get())

    if (!v.set) {
      console.warn(`tried to mail a readable`, m.whom.get())
      return
    }

    v.set(value_new)
  }

  // Subscribe to remote
  const m = ({
    knot: read(`mail`),
    whom: transformer((whom_new) => {
      weave.mails.update(($mails) => ({
        ...$mails,
        [id]: whom_new
      }))

      return whom_new
    }).set(whom),
    value,
    set
  })

  return m
}
