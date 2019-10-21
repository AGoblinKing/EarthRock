const TILE_MAX = 1024
const NAME_MAX = 5
const COST_MAX = 10
const EFFECT_MAX = 3
const DECK_SIZE = 30
const HAND_SIZE_INIT = 7

// width * height
const IMAGE_COUNT = 10 * 10 
const BACK_COUNT = 3 * 5

// shitty shitty uuid generator but good nuff for our server fake
const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    })
  
const tile_random = (count) => {
    const tiles = []
    for(let i = 0; i < count; i++) {
        tiles.push(Math.floor(Math.random() * TILE_MAX))
    }

    return tiles.join(" ")
}

const card_blank = () => ({
    id: uuidv4(),
    name: "",
    image: "",
    cost: 0,
    effect1: null,
    effect2: null,
    effect3: null
})

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
    for(let i = 0; i < count; i++) {
        cards.push(card_random())
    }

    return cards
}

const server_fake = (game) => {
    const tasks = {
        ERROR_404: () => ({
            code: 404,
            text: 'TaSk NoT FoUnD'
        })
    }

    // Setup Game State
    game.do({
        task: 'STATE',
        data: {
            away_deck: cards_random(DECK_SIZE),
            home_deck: cards_random(DECK_SIZE),
            away_hand: cards_random(HAND_SIZE_INIT),
            home_hand: cards_random(HAND_SIZE_INIT),
            away_back: tile_random(BACK_COUNT),
            home_back: tile_random(BACK_COUNT)
        }
    })
   
    return ({
        task,
        data
    }) => {
        if(!tasks[task]) {
            return tasks.ERROR_404()
        }

        return tasks[task](data)
    }
}


export default server_fake