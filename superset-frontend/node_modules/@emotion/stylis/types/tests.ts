import Stylis, {
  Context,
  PrefixContext,
  StylisUse,
  StylisSet
} from '@emotion/stylis'

new Stylis()
// $ExpectError
new Stylis(5)
// $ExpectError
new Stylis('abc')
// $ExpectError
new Stylis([])
new Stylis({})
new Stylis({
  // $ExpectError
  a: 5
})
new Stylis({
  prefix: undefined
})
new Stylis({
  prefix: true
})
new Stylis({
  prefix: false
})
new Stylis({
  prefix() {
    return true
  }
})
new Stylis({
  prefix(key: string) {
    return key === 'abc'
  }
})
new Stylis({
  prefix(key: string, value: string, context: PrefixContext) {
    return value === 'world'
  }
})
// $ExpectError
new Stylis({
  prefix(key: string, value: string, context: PrefixContext) {
    return 'hi'
  }
})
// $ExpectError
new Stylis({
  prefix(key: string, value: string, context: PrefixContext, a: any) {
    return true
  }
})

const stylis0 = new Stylis()
const stylis1: Stylis = stylis0
const stylis2: Stylis = new Stylis()
const stylis3 = new stylis2()
const stylis4: Stylis = stylis3

const stylis = new Stylis()

// $ExpectError
stylis.set()
stylis.set({})
stylis.set({
  prefix: true
})
stylis.set({
  prefix(key: string) {
    return false
  }
})
stylis.set({
  prefix(key: string, value: string, context: PrefixContext) {
    return false
  }
})
// $ExpectError
stylis.set({ prefix: () => 'hi' })

stylis.use()
// $ExpectError
stylis.use(5)
// $ExpectError
stylis.use('ac')
stylis.use(true)
stylis.use(false)
stylis.use(null)
stylis.use(undefined)
// $ExpectError
stylis.use({})
stylis.use([])
stylis.use(function() {})
stylis.use(function(context) {})
stylis.use(function(context: Context) {
  return 'abc'
})
stylis.use(function(context: Context, content, selector, parent) {
  const x: StylisUse = this.use
})
stylis.use(function(
  context: Context,
  content,
  selector,
  parent,
  line,
  column,
  length
) {
  const x: StylisSet = this.set
})
stylis.use([
  function(
    context: Context,
    content,
    selector,
    parent,
    line,
    column,
    length,
    at,
    depth
  ) {
    const x: StylisSet = this.set
  }
])
// $ExpectError
stylis.use(function(
  context: Context,
  // $ExpectError
  content,
  // $ExpectError
  selector,
  // $ExpectError
  parent,
  // $ExpectError
  line,
  // $ExpectError
  column,
  // $ExpectError
  length,
  // $ExpectError
  at,
  // $ExpectError
  depth,
  // $ExpectError
  a
) {
  return 'test'
})

// $ExpectError
stylis()
// $ExpectError
stylis('abc')
// $ExpectError
stylis('abc', 5)
// $ExpectError
stylis([], 'abc')
stylis('abc', 'cde')
