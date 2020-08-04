import has from './hasOwnProperty';

const DEFAULT_MAX_SIZE = 10000;

// adapted from https://github.com/dominictarr/hashlru/ (MIT License)
export default function(maxsize) {
  maxsize = +maxsize || DEFAULT_MAX_SIZE;

  let curr, prev, size;

  const clear = () => {
    curr = {};
    prev = {};
    size = 0;
  };

  const update = (key, value) => {
    if (++size > maxsize) {
      prev = curr;
      curr = {};
      size = 1;
    }
    return (curr[key] = value);
  };

  clear();

  return {
    clear,
    has: key => has(curr, key) || has(prev, key),
    get: key => has(curr, key) ? curr[key]
        : has(prev, key) ? update(key, prev[key])
        : undefined,
    set: (key, value) => has(curr, key)
        ? (curr[key] = value)
        : update(key, value)
  };
}
