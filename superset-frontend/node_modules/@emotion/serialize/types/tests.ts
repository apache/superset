import {
  CSSObject,
  ObjectInterpolation,
  Keyframes,
  serializeStyles
} from '@emotion/serialize'

declare const testTemplateStringsArray: TemplateStringsArray
declare const testKeyframes: Keyframes

const testObjectInterpolation0: ObjectInterpolation<undefined> = {
  animation: testKeyframes
}
const testObjectInterpolation1: ObjectInterpolation<undefined> = {
  animationName: testKeyframes
}

// $ExpectType SerializedStyles
serializeStyles({}, [])
// $ExpectType SerializedStyles
serializeStyles(
  {
    'emotion-cache': 'width: 200px'
  },
  []
)
// $ExpectType SerializedStyles
serializeStyles({}, [], {})
// $ExpectType SerializedStyles
serializeStyles({}, ['abc'], {})
// $ExpectType SerializedStyles
serializeStyles({}, ['width: 200px;'], {})
// $ExpectType SerializedStyles
serializeStyles({}, [() => 'height: 300px;'], {})
// $ExpectType SerializedStyles
serializeStyles(
  {},
  [
    'display: block;',
    {
      flexGrow: 1,
      backgroundColor: 'red'
    }
  ],
  {}
)
// $ExpectType SerializedStyles
serializeStyles({}, [testTemplateStringsArray, 5, '4px'], {})

// $ExpectError
serializeStyles()
// $ExpectError
serializeStyles({})
// $ExpectError
serializeStyles({}, {})

let cssObject: CSSObject = {
  fontWeight: 400,
  ':hover': {
    fontWeight: 700
  }
}

// $ExpectError
cssObject = { fontWeight: 'wrong' }
