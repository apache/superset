// @flow
import { createMacro } from 'babel-plugin-macros'
import { addDefault, addNamed } from '@babel/helper-module-imports'
import { transformExpressionWithStyles } from './utils'

export const transformCssCallExpression = ({
  babel,
  state,
  path,
  sourceMap
}: {
  babel: *,
  state: *,
  path: *,
  sourceMap?: string
}) => {
  let node = transformExpressionWithStyles({
    babel,
    state,
    path,
    shouldLabel: true,
    sourceMap
  })
  if (node) {
    path.replaceWith(node)
    path.hoist()
  } else if (path.isCallExpression()) {
    path.addComment('leading', '#__PURE__')
  }
}

export default createMacro(({ references, state, babel, isEmotionCall }) => {
  if (!isEmotionCall) {
    state.emotionSourceMap = true
  }
  const t = babel.types
  if (references.default && references.default.length) {
    references.default.reverse().forEach(reference => {
      if (!state.cssIdentifier) {
        state.cssIdentifier = addDefault(reference, '@emotion/css', {
          nameHint: 'css'
        })
      }
      reference.replaceWith(t.cloneDeep(state.cssIdentifier))
      transformCssCallExpression({ babel, state, path: reference.parentPath })
    })
  }
  Object.keys(references)
    .filter(x => x !== 'default')
    .forEach(referenceKey => {
      let runtimeNode = addNamed(
        state.file.path,
        referenceKey,
        '@emotion/css',
        { nameHint: referenceKey }
      )

      references[referenceKey].reverse().forEach(reference => {
        reference.replaceWith(t.cloneDeep(runtimeNode))
      })
    })
})
