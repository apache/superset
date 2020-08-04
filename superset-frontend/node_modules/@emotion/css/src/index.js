// @flow

import type { Interpolation, SerializedStyles } from '@emotion/utils'
import { serializeStyles } from '@emotion/serialize'

function css(...args: Array<Interpolation>): SerializedStyles {
  return serializeStyles(args)
}

export default css
