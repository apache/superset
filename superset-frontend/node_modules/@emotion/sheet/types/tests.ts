import { Options, StyleSheet } from '@emotion/sheet'

new StyleSheet({
  key: 'abc',
  container: document.createElement('div')
})

new StyleSheet({
  key: 'abc',
  container: document.createElement('div'),
  nonce: 'fefwe090rqr'
})
new StyleSheet({
  key: 'abc',
  container: document.createElement('div'),
  speedy: true
})
// $ExpectError
new StyleSheet({
  container: document.createElement('div'),
  key: 120
})
new StyleSheet({
  container: document.createElement('div'),
  // $ExpectError
  kye: 'abc'
})

const styleSheet0 = new StyleSheet({
  key: 'abc',
  container: document.createElement('div')
})
const styleSheet1: StyleSheet = styleSheet0
const styleSheet2: StyleSheet = new StyleSheet()

const styleSheet = new StyleSheet({
  key: 'abc',
  container: document.createElement('div')
})

styleSheet.insert('.name{ color: black; }')
styleSheet.insert('.cl{ width: 200px; height: 200px; }')
// $ExpectError
styleSheet.insert()
// $ExpectError
styleSheet.insert('.name{ color: black; }', undefined as any)
// $ExpectError
styleSheet.insert(
  '.name{ color: black; }',
  ...((undefined as any) as Array<any>)
)

styleSheet.flush()
// $ExpectError
styleSheet.flush(undefined as any)
// $ExpectError
styleSheet.flush(...((undefined as any) as Array<any>))
