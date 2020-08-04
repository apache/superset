import syntaxJsx from '@babel/plugin-syntax-jsx'

const findLast = (arr, predicate) => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) {
      return arr[i]
    }
  }
}

export default function jsxPragmatic(babel) {
  const t = babel.types

  function addPragmaImport(path, state) {
    const importDeclar = t.importDeclaration(
      [
        t.importSpecifier(
          t.identifier(state.opts.import),
          t.identifier(state.opts.export || 'default')
        )
      ],
      t.stringLiteral(state.opts.module)
    )

    const targetPath = findLast(path.get('body'), p => p.isImportDeclaration())

    if (targetPath) {
      targetPath.insertAfter([importDeclar])
    } else {
      // Apparently it's now safe to do this even if Program begins with directives.
      path.unshiftContainer('body', importDeclar)
    }
  }

  return {
    inherits: syntaxJsx,
    pre: function() {
      if (!(this.opts.module && this.opts.import)) {
        throw new Error(
          '@emotion/babel-plugin-jsx-pragmatic: You must specify `module` and `import`'
        )
      }
    },
    visitor: {
      Program: {
        exit: function(path, state) {
          if (!state.get('jsxDetected')) return
          addPragmaImport(path, state)
        }
      },

      JSXElement: function(path, state) {
        state.set('jsxDetected', true)
      },
      JSXFragment: function(path, state) {
        state.set('jsxDetected', true)
      }
    }
  }
}
