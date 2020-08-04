import {toSet} from 'vega-util';

const Skip = toSet(['rule']),
      Swap = toSet(['group', 'image', 'rect']);

export function adjustSpatial(encode, marktype) {
  let code = '';

  if (Skip[marktype]) return code;

  if (encode.x2) {
    if (encode.x) {
      if (Swap[marktype]) {
        code += 'if(o.x>o.x2)$=o.x,o.x=o.x2,o.x2=$;';
      }
      code += 'o.width=o.x2-o.x;';
    } else {
      code += 'o.x=o.x2-(o.width||0);';
    }
  }

  if (encode.xc) {
    code += 'o.x=o.xc-(o.width||0)/2;';
  }

  if (encode.y2) {
    if (encode.y) {
      if (Swap[marktype]) {
        code += 'if(o.y>o.y2)$=o.y,o.y=o.y2,o.y2=$;';
      }
      code += 'o.height=o.y2-o.y;';
    } else {
      code += 'o.y=o.y2-(o.height||0);';
    }
  }

  if (encode.yc) {
    code += 'o.y=o.yc-(o.height||0)/2;';
  }

  return code;
}

export function canonicalType(type) {
  return (type + '').toLowerCase();
}

export function isOperator(type) {
   return canonicalType(type) === 'operator';
}

export function isCollect(type) {
  return canonicalType(type) === 'collect';
}
