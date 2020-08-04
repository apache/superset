// @flow
import { transformExpressionWithStyles } from './utils'
import { addNamed } from '@babel/helper-module-imports'
import { createMacro } from 'babel-plugin-macros'

export let createEmotionMacro = (instancePath: string) =>
  createMacro(function macro({ references, state, babel, isEmotionCall }) {
    if (!isEmotionCall) {
      state.emotionSourceMap = true
    }

    let t = babel.types
    Object.keys(references).forEach(referenceKey => {
      let isPure = true
      let runtimeNode = addNamed(state.file.path, referenceKey, instancePath)

      switch (referenceKey) {
        case 'injectGlobal': {
          isPure = false
        }
        // eslint-disable-next-line no-fallthrough
        case 'css':
        case 'keyframes': {
          references[referenceKey].reverse().forEach(reference => {
            const path = reference.parentPath

            reference.replaceWith(t.cloneDeep(runtimeNode))
            if (isPure) {
              path.addComment('leading', '#__PURE__')
            }
            let node = transformExpressionWithStyles({
              babel,
              state,
              path,
              shouldLabel: true
            })
            if (node) {
              path.node.arguments[0] = node
            }
          })
          break
        }
        default: {
          references[referenceKey].reverse().forEach(reference => {
            reference.replaceWith(t.cloneDeep(runtimeNode))
          })
        }
      }
    })
  })
