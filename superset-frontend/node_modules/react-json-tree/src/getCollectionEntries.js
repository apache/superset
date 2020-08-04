function getLength(type, collection) {
  if (type === 'Object') {
    return Object.keys(collection).length;
  } else if (type === 'Array') {
    return collection.length;
  }

  return Infinity;
}

function isIterableMap(collection) {
  return typeof collection.set === 'function';
}

function getEntries(type, collection, sortObjectKeys, from = 0, to = Infinity) {
  let res;

  if (type === 'Object') {
    let keys = Object.getOwnPropertyNames(collection);

    if (sortObjectKeys) {
      keys.sort(sortObjectKeys === true ? undefined : sortObjectKeys);
    }

    keys = keys.slice(from, to + 1);

    res = {
      entries: keys.map(key => ({ key, value: collection[key] }))
    };
  } else if (type === 'Array') {
    res = {
      entries: collection
        .slice(from, to + 1)
        .map((val, idx) => ({ key: idx + from, value: val }))
    };
  } else {
    let idx = 0;
    const entries = [];
    let done = true;

    const isMap = isIterableMap(collection);

    for (const item of collection) {
      if (idx > to) {
        done = false;
        break;
      }
      if (from <= idx) {
        if (isMap && Array.isArray(item)) {
          if (typeof item[0] === 'string' || typeof item[0] === 'number') {
            entries.push({ key: item[0], value: item[1] });
          } else {
            entries.push({
              key: `[entry ${idx}]`,
              value: {
                '[key]': item[0],
                '[value]': item[1]
              }
            });
          }
        } else {
          entries.push({ key: idx, value: item });
        }
      }
      idx++;
    }

    res = {
      hasMore: !done,
      entries
    };
  }

  return res;
}

function getRanges(from, to, limit) {
  const ranges = [];
  while (to - from > limit * limit) {
    limit = limit * limit;
  }
  for (let i = from; i <= to; i += limit) {
    ranges.push({ from: i, to: Math.min(to, i + limit - 1) });
  }

  return ranges;
}

export default function getCollectionEntries(
  type,
  collection,
  sortObjectKeys,
  limit,
  from = 0,
  to = Infinity
) {
  const getEntriesBound = getEntries.bind(
    null,
    type,
    collection,
    sortObjectKeys
  );

  if (!limit) {
    return getEntriesBound().entries;
  }

  const isSubset = to < Infinity;
  const length = Math.min(to - from, getLength(type, collection));

  if (type !== 'Iterable') {
    if (length <= limit || limit < 7) {
      return getEntriesBound(from, to).entries;
    }
  } else {
    if (length <= limit && !isSubset) {
      return getEntriesBound(from, to).entries;
    }
  }

  let limitedEntries;
  if (type === 'Iterable') {
    const { hasMore, entries } = getEntriesBound(from, from + limit - 1);

    limitedEntries = hasMore
      ? [...entries, ...getRanges(from + limit, from + 2 * limit - 1, limit)]
      : entries;
  } else {
    limitedEntries = isSubset
      ? getRanges(from, to, limit)
      : [
          ...getEntriesBound(0, limit - 5).entries,
          ...getRanges(limit - 4, length - 5, limit),
          ...getEntriesBound(length - 4, length - 1).entries
        ];
  }

  return limitedEntries;
}
