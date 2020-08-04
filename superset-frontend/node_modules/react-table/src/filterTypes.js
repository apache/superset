export const text = (rows, ids, filterValue) => {
  rows = rows.filter(row => {
    return ids.some(id => {
      const rowValue = row.values[id]
      return String(rowValue)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    })
  })
  return rows
}

text.autoRemove = val => !val

export const exactText = (rows, ids, filterValue) => {
  return rows.filter(row => {
    return ids.some(id => {
      const rowValue = row.values[id]
      return rowValue !== undefined
        ? String(rowValue).toLowerCase() === String(filterValue).toLowerCase()
        : true
    })
  })
}

exactText.autoRemove = val => !val

export const exactTextCase = (rows, ids, filterValue) => {
  return rows.filter(row => {
    return ids.some(id => {
      const rowValue = row.values[id]
      return rowValue !== undefined
        ? String(rowValue) === String(filterValue)
        : true
    })
  })
}

exactTextCase.autoRemove = val => !val

export const includes = (rows, ids, filterValue) => {
  return rows.filter(row => {
    return ids.some(id => {
      const rowValue = row.values[id]
      return rowValue.includes(filterValue)
    })
  })
}

includes.autoRemove = val => !val || !val.length

export const includesAll = (rows, ids, filterValue) => {
  return rows.filter(row => {
    return ids.some(id => {
      const rowValue = row.values[id]
      return (
        rowValue &&
        rowValue.length &&
        filterValue.every(val => rowValue.includes(val))
      )
    })
  })
}

includesAll.autoRemove = val => !val || !val.length

export const exact = (rows, ids, filterValue) => {
  return rows.filter(row => {
    return ids.some(id => {
      const rowValue = row.values[id]
      return rowValue === filterValue
    })
  })
}

exact.autoRemove = val => typeof val === 'undefined'

export const equals = (rows, ids, filterValue) => {
  return rows.filter(row => {
    return ids.some(id => {
      const rowValue = row.values[id]
      // eslint-disable-next-line eqeqeq
      return rowValue == filterValue
    })
  })
}

equals.autoRemove = val => val == null

export const between = (rows, ids, filterValue) => {
  let [min, max] = filterValue || []

  min = typeof min === 'number' ? min : -Infinity
  max = typeof max === 'number' ? max : Infinity

  if (min > max) {
    const temp = min
    min = max
    max = temp
  }

  return rows.filter(row => {
    return ids.some(id => {
      const rowValue = row.values[id]
      return rowValue >= min && rowValue <= max
    })
  })
}

between.autoRemove = val =>
  !val || (typeof val[0] !== 'number' && typeof val[1] !== 'number')
