export const toJSON = (obj) => Object.fromEntries(
  Object.entries(obj)
    .filter(([key, val]) => {

    })
    .map(([key, val]) => {
      return [key, val.toJSON()]
    })
)

export const powerToJSON = (obj) => {
  obj.toJSON = () => toJSON(obj)
  return obj
}

export const multiply = (...arrs) => arrs.reduce((result, arr) => {
  arr.forEach((val, i) => {
    if (i > result.length - 1) {
      result.push(val)
    }

    result[i] *= val
  })
  return result
}, [])

export const add = (...arrs) => arrs.reduce((result, arr) => {
  arr.forEach((val, i) => {
    if (i > result.length - 1) {
      result.push(val)
    }

    result[i] += val
  })
  return result
}, [])
