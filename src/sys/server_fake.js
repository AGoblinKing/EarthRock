const TILE_MAX = 1024
const NAME_MAX = 5

const COST_MAX = 10
const EFFECT_MAX = 3
const DECK_SIZE = 30
const HAND_SIZE_INIT = 5

// width * height
const IMAGE_COUNT = 5 * 5
const BACK_COUNT = 3 * 5

// shitty shitty uuid generator but good nuff for our server fake
const uuidv4 = () => `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0
  const v = c === `x`
    ? r
    : (r & 0x3 | 0x8)

  return v.toString(16)
})

const token_random = (overides) => ({
  id: uuidv4(),
  data: tile_random(IMAGE_COUNT),
  ...overides
})

const tile_random = (count) => {
  const tiles = []
  for (let i = 0; i < count; i++) {
    tiles.push(Math.floor(Math.random() * TILE_MAX))
  }

  return tiles.join(` `)
}

// const card_blank = () => ({
//   id: uuidv4(),
//   name: ``,
//   image: ``,
//   cost: 0,
//   effect1: null,
//   effect2: null,
//   effect3: null
// })

const card_random = () => ({
  id: uuidv4(),
  name: tile_random(NAME_MAX),
  image: tile_random(IMAGE_COUNT),
  cost: Math.floor(Math.random() * COST_MAX),
  effect1: tile_random(EFFECT_MAX),
  effect2: tile_random(EFFECT_MAX),
  effect3: tile_random(EFFECT_MAX)
})

const cards_random = (count) => {
  const cards = []
  for (let i = 0; i < count; i++) {
    cards.push(card_random())
  }

  return cards
}

const server_fake = (game) => {
  const state = {
    away_deck: cards_random(DECK_SIZE),
    home_deck: cards_random(DECK_SIZE),
    away_hand: cards_random(HAND_SIZE_INIT),
    home_hand: cards_random(HAND_SIZE_INIT),
    away_back: tile_random(BACK_COUNT),
    home_back: tile_random(BACK_COUNT),
    home_discard: [],
    home_gems: Math.floor(Math.random() * 10),
    home_hearts: Math.floor(Math.random() * 6),
    away_hearts: Math.floor(Math.random() * 6),
    away_discard: [],
    away_gems: Math.floor(Math.random() * 10),
    away_tokens: [token_random({
      king: true
    })]
  }

  state.home_tokens = [
    token_random({
      king: true,
      data: state.home_back,
      color: 90,
      stats: {
        gems: state.home_gems,
        hearts: state.home_hearts
      }
    })
  ]

  const tasks = {
    RESTART: () => {

    },

    PLAY: ({
      id
    }) => {
      const {
        home_hand,
        home_discard
      } = state

      for (let i = 0; i < state.home_hand.length; i++) {
        const card = state.home_hand[i]

        if (card.id === id) {
          home_hand.splice(i, 1)
          home_discard.unshift(card)
          game.do({
            task: `STATE`,
            data: {
              home_hand,
              home_discard
            }
          })
          return tasks.SUCCESS()
        }
      }
    },
    DRAW: () => {
      const { home_deck, home_hand } = state

      home_hand.push(home_deck.pop())

      game.do({
        task: `STATE`,
        data: {
          home_deck,
          home_hand
        }
      })

      return tasks.SUCCESS()
    },
    SUCCESS: () => ({
      code: 200,
      text: `SuCcEsS`
    }),
    ERROR_404: () => ({
      code: 404,
      text: `TaSk NoT FoUnD`
    })
  }

  // Setup Game State
  game.do({
    task: `STATE`,
    data: state
  })

  return ({
    task,
    data
  }) => {
    if (!tasks[task]) {
      return tasks.ERROR_404()
    }

    return tasks[task](data)
  }
}

export default server_fake
