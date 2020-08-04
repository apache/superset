export function sum(values, aggregatedValues) {
  // It's faster to just add the aggregations together instead of
  // process leaf nodes individually
  return aggregatedValues.reduce(
    (sum, next) => sum + (typeof next === 'number' ? next : 0),
    0
  )
}

export function min(values) {
  let min = 0

  values.forEach(value => {
    if (typeof value === 'number') {
      min = Math.min(min, value)
    }
  })

  return min
}

export function max(values) {
  let max = 0

  values.forEach(value => {
    if (typeof value === 'number') {
      max = Math.max(max, value)
    }
  })

  return max
}

export function minMax(values) {
  let min = 0
  let max = 0

  values.forEach(value => {
    if (typeof value === 'number') {
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
  })

  return `${min}..${max}`
}

export function average(values) {
  return sum(null, values) / values.length
}

export function median(values) {
  if (!values.length) {
    return null
  }

  let min = 0
  let max = 0

  values.forEach(value => {
    if (typeof value === 'number') {
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
  })

  return (min + max) / 2
}

export function unique(values) {
  return [...new Set(values).values()]
}

export function uniqueCount(values) {
  return new Set(values).size
}

export function count(values) {
  return values.length
}
