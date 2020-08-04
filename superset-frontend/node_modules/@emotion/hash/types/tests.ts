import hash from '@emotion/hash'

// $ExpectType string
hash('color: hotpink;')

// $ExpectError
hash()
// $ExpectError
const hashed2: number = hash('color: hotpink;')
// $ExpectError
hash(42)
// $ExpectError
hash({})
// $ExpectError
hash('color: hotpink;', 'background-color: #fff;')
