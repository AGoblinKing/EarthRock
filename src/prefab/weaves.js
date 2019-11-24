export const Basic = () => ({
  knots: {
    mail: {
      knot: `mail`
    },
    stream: {
      knot: `stream`
    },
    math: {
      knot: `math`,
      math: `[v[0]/10, v[1]/10]`
    },
    stitch: {
      name: `player`,
      knot: `stitch`,
      value: {
        position: [0, 0],
        screen: null,
        foo: null
      }
    },
    main: {
      knot: `mail`,
      whom: `/sys/screen/main`
    },
    stream2: {
      knot: `stream`
    },
    screen2: {
      knot: `screen`
    },
    math2: {
      knot: `math`
    },
    math3: {
      knot: `math`
    }
  },
  threads: {
    mail: `stream`,
    stream: `math`,
    math: `stitch/position`,
    screen2: `main`,
    stream2: `stitch/foo`,
    stitch: `screen2`,
    "stitch/screen": `math2`,
    "stitch/foo": `math3`
  }
})
