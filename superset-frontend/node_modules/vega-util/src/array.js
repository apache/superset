import isArray from './isArray';

export default function(_) {
  return _ != null ? (isArray(_) ? _ : [_]) : [];
}
