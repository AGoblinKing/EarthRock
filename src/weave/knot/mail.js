import { transformer, write, read } from "/util/store.js"

// instead use the weave messaging channel
export default ({
  whom = `/sys/mouse/position`,
  weave,
  id
}) => {
  const value = write()
  const { set } = value

  // use the mail channel
  value.set = (value_new) => Wheel.get(`/sys/mail/send`).set({
    whom: m.whom.get(),
    value: value_new
  })

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
