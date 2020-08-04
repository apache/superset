import createCache, { Options } from '@emotion/cache'

declare const testOptions: Options

// $ExpectType EmotionCache
createCache()
// $ExpectType EmotionCache
createCache(testOptions)
