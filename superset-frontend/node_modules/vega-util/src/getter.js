export default function(path) {
  return path.length === 1 ? get1(path[0]) : getN(path);
}

const get1 = field => function(obj) {
  return obj[field];
};

const getN = path => {
  const len = path.length;
  return function(obj) {
    for (let i = 0; i < len; ++i) {
      obj = obj[path[i]];
    }
    return obj;
  };
};

