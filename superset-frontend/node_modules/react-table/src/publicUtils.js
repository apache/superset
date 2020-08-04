import React from 'react'

let renderErr = 'Renderer Error ☝️'

export const actions = {
  init: 'init',
}

export const defaultColumn = {
  Cell: ({ value = '' }) => value,
  width: 150,
  minWidth: 0,
  maxWidth: Number.MAX_SAFE_INTEGER,
}

function mergeProps(...propList) {
  return propList.reduce((props, next) => {
    const { style, className, ...rest } = next

    props = {
      ...props,
      ...rest,
    }

    if (style) {
      props.style = props.style
        ? { ...(props.style || {}), ...(style || {}) }
        : style
    }

    if (className) {
      props.className = props.className
        ? props.className + ' ' + className
        : className
    }

    if (props.className === '') {
      delete props.className
    }

    return props
  }, {})
}

function handlePropGetter(prevProps, userProps, meta) {
  // Handle a lambda, pass it the previous props
  if (typeof userProps === 'function') {
    return handlePropGetter({}, userProps(prevProps, meta))
  }

  // Handle an array, merge each item as separate props
  if (Array.isArray(userProps)) {
    return mergeProps(prevProps, ...userProps)
  }

  // Handle an object by default, merge the two objects
  return mergeProps(prevProps, userProps)
}

export const makePropGetter = (hooks, meta = {}) => {
  return (userProps = {}) =>
    [...hooks, userProps].reduce(
      (prev, next) =>
        handlePropGetter(prev, next, {
          ...meta,
          userProps,
        }),
      {}
    )
}

export const reduceHooks = (hooks, initial, meta = {}, allowUndefined) =>
  hooks.reduce((prev, next) => {
    const nextValue = next(prev, meta)
    if (process.env.NODE_ENV !== 'production') {
      if (!allowUndefined && typeof nextValue === 'undefined') {
        console.info(next)
        throw new Error(
          'React Table: A reducer hook ☝️ just returned undefined! This is not allowed.'
        )
      }
    }
    return nextValue
  }, initial)

export const loopHooks = (hooks, context, meta = {}) =>
  hooks.forEach(hook => {
    const nextValue = hook(context, meta)
    if (process.env.NODE_ENV !== 'production') {
      if (typeof nextValue !== 'undefined') {
        console.info(hook, nextValue)
        throw new Error(
          'React Table: A loop-type hook ☝️ just returned a value! This is not allowed.'
        )
      }
    }
  })

export function ensurePluginOrder(plugins, befores, pluginName, afters) {
  if (process.env.NODE_ENV !== 'production' && afters) {
    throw new Error(
      `Defining plugins in the "after" section of ensurePluginOrder is no longer supported (see plugin ${pluginName})`
    )
  }
  const pluginIndex = plugins.findIndex(
    plugin => plugin.pluginName === pluginName
  )

  if (pluginIndex === -1) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`The plugin "${pluginName}" was not found in the plugin list!
This usually means you need to need to name your plugin hook by setting the 'pluginName' property of the hook function, eg:

  ${pluginName}.pluginName = '${pluginName}'
`)
    }
  }

  befores.forEach(before => {
    const beforeIndex = plugins.findIndex(
      plugin => plugin.pluginName === before
    )
    if (beforeIndex > -1 && beforeIndex > pluginIndex) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          `React Table: The ${pluginName} plugin hook must be placed after the ${before} plugin hook!`
        )
      }
    }
  })
}

export function functionalUpdate(updater, old) {
  return typeof updater === 'function' ? updater(old) : updater
}

export function useGetLatest(obj) {
  const ref = React.useRef()
  ref.current = obj

  return React.useCallback(() => ref.current, [])
}

// SSR has issues with useLayoutEffect still, so use useEffect during SSR
export const safeUseLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect

export function useMountedLayoutEffect(fn, deps) {
  const mountedRef = React.useRef(false)

  safeUseLayoutEffect(() => {
    if (mountedRef.current) {
      fn()
    }
    mountedRef.current = true
    // eslint-disable-next-line
  }, deps)
}

export function useAsyncDebounce(defaultFn, defaultWait = 0) {
  const debounceRef = React.useRef({})

  const getDefaultFn = useGetLatest(defaultFn)
  const getDefaultWait = useGetLatest(defaultWait)

  return React.useCallback(
    async (...args) => {
      if (!debounceRef.current.promise) {
        debounceRef.current.promise = new Promise((resolve, reject) => {
          debounceRef.current.resolve = resolve
          debounceRef.current.reject = reject
        })
      }

      if (debounceRef.current.timeout) {
        clearTimeout(debounceRef.current.timeout)
      }

      debounceRef.current.timeout = setTimeout(async () => {
        delete debounceRef.current.timeout
        try {
          debounceRef.current.resolve(await getDefaultFn()(...args))
        } catch (err) {
          debounceRef.current.reject(err)
        } finally {
          delete debounceRef.current.promise
        }
      }, getDefaultWait())

      return debounceRef.current.promise
    },
    [getDefaultFn, getDefaultWait]
  )
}

export function makeRenderer(instance, column, meta = {}) {
  return (type, userProps = {}) => {
    const Comp = typeof type === 'string' ? column[type] : type

    if (typeof Comp === 'undefined') {
      console.info(column)
      throw new Error(renderErr)
    }

    return flexRender(Comp, { ...instance, column, ...meta, ...userProps })
  }
}

export function flexRender(Comp, props) {
  return isReactComponent(Comp) ? <Comp {...props} /> : Comp
}

function isReactComponent(component) {
  return (
    isClassComponent(component) ||
    typeof component === 'function' ||
    isExoticComponent(component)
  )
}

function isClassComponent(component) {
  return (
    typeof component === 'function' &&
    (() => {
      const proto = Object.getPrototypeOf(component)
      return proto.prototype && proto.prototype.isReactComponent
    })()
  )
}

function isExoticComponent(component) {
  return (
    typeof component === 'object' &&
    typeof component.$$typeof === 'symbol' &&
    ['react.memo', 'react.forward_ref'].includes(component.$$typeof.description)
  )
}
