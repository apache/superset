/* eslint no-param-reassign: 0 */
import callOrValue from './callOrValue';

export default function additionalProps(restProps, data) {
  return Object.keys(restProps).reduce((ret, cur) => {
    ret[cur] = callOrValue(restProps[cur], data);
    return ret;
  }, {});
}
