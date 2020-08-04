import {
  EmotionCache,
  RegisteredCache,
  SerializedStyles,
  StyleSheet,
  getRegisteredStyles,
  insertStyles,
  isBrowser
} from '@emotion/utils'

declare const testCache: EmotionCache
declare const testRegisteredCache: RegisteredCache

getRegisteredStyles(testRegisteredCache, [], 'abc')
getRegisteredStyles(testRegisteredCache, [], 'abc def')
getRegisteredStyles(testRegisteredCache, [], 'dead end')
getRegisteredStyles(testRegisteredCache, ['color: red;'], 'black parade')
// $ExpectError
getRegisteredStyles()
// $ExpectError
getRegisteredStyles(testRegisteredCache)

insertStyles(
  testCache,
  {
    name: 'abc',
    styles: 'color: green;background: red;'
  },
  false
)
// $ExpectError
insertStyles()
// $ExpectError
insertStyles(testCache)
// $ExpectError
insertStyles(testCache, {})
// $ExpectError
insertStyles(testCache, {
  name: 'abc',
  styles: 'font-size: 18px;'
})

const test0: boolean = isBrowser
// $ExpectError
const test1: number = isBrowser
