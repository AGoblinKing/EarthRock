import { v3 } from "twgl"

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

export const add = (...vecs) => vecs.reduce((result, vec) =>
  v3.add(result, vec)
, [0, 0, 0])

export const minus = v3.subtract
export const lerp = v3.lerp
export const length = v3.length
export const divide_scalar = v3.divScalar
export const divide = v3.divide
export const multiply = v3.multiply
export const multiply_scalar = v3.mulScalar
export const distance = v3.distance
export const negate = v3.negate
