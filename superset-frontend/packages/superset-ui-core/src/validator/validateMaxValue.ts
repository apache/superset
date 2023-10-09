import { t } from '../translation';

export default function validateMaxValue(v: unknown, max: Number) {
  if (typeof Number(v) === 'number' && Number(v) > +max) {
    return t('Value cannot exceed %s', max);
  }
  return false;
}
