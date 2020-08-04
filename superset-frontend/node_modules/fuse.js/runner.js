const util = require('util')

const Fuse = require('./src')
// const items = ['t te tes test tes te t']

// const fuse = new Fuse(items, {
//   showMatches: true,
//   // findAllMatches: true,
//   minMatchCharLength: 2,
//   verbose: true
// })

// var result = fuse.search('test')
// console.log(util.inspect(result, false, null))

const needle = "of war for the planet of the apes";
const items = [
  // { title: "War for the Planet of the Apes" },
  { title: "Storks" }
]

const fuse = new Fuse(items, {
  shouldSort: true,
  threshold: 0.6,
  location: 0,
  distance: 100,
  maxPatternLength: 64,
  minMatchCharLength: 1,
  keys: [
    "title",
  ],
  verbose: true
})

const result = fuse.search(needle);