![logo](https://earthrock.run/weave/demo/img/logo.gif)

# Earthrock
### <Uncollectable Card Game>
![logo](https://earthrock.run/weave/demo/img/weave-latest.png)
 
![ohya](https://earthrock.run/weave/demo/img/ohya.png)
 
# WARNING
### THIS IS AND ALWAYS WILL BE AN EXPERIMENTAL BRANCH. 
### FORK IT FOR STABILITY.

## Basis for MVP
 1. Custom Decks
    - Maximum point value, eg: 60
    - Point value per card
    - Deck card back set by image map
    - Uses TOML or maybe embed into image?
    - Required 30 cards
    - Name [from set list]
    - Ability chosen from set
    - Portrait from image map
    - private uuid to ID the player
    - kept in database
 2. Custom Cards
    - Name [From set list of words combined]
    - Image from image map
    - Have resource cost that raises based on points added
    - Type
        - Monster
            - Monsters go on the battle field
            - Have ATTACK [n] / [n] HEALTH, generally starts at 1/1
        - Spell
            - Can do one of many effects
            - Do [n] damage 
            - Heal [n] damage
        - Trap
            - Persistant spell with a trigger
            - [ON ATTACK] [DESTROY ATTACKER] +3
    - Use Rock Paper Scissors for "randomness"
    - Offline can use dice instead decide ahead of time
    
 3. Internet Matches
    - Paste deck in
    - Types
        - Link Match (Link someone a match ID)
        - Find Match (Finds another person to play against)
    - Winner gets a point on that deck. Show deck W in FM and LM. Change color based on # of wins
    - Rules enforced server side

## Technology
    - Node.js server for now
    - Go Wheel Server ASAP
    - Use JSON for messaging right now
    - POST w/ SSE down.
    
