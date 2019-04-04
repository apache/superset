import ShallowWrapper from './ShallowWrapper';

/**
 * Shallow renders a react component and provides a testing wrapper around it.
 *
 * @param node
 * @returns {ShallowWrapper}
 */
export default function shallow(node, options) {
  return new ShallowWrapper(node, null, options);
}
