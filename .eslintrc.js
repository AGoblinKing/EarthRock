
module.exports = {
    "extends": "standard",
    "env": {
        browser: true
    },
    "plugins": [
        "svelte3"
    ],
    "overrides": [{
        files: [ '**/*.svelte' ],
        processor: 'svelte3/svelte3'
    }],
    "rules": {
        "import/no-absolute-path": ["off"],
        "import/first": ["off"],
        quotes: ["error", "backtick"],
        camelcase: ["off"]
    }
};