import ownKeys from 'reflect.ownkeys';
import exact from './';

const [semaphore] = ownKeys(exact({}));

export default function sloppy({ [semaphore]: _, ...propTypes }) {
  return propTypes;
}
