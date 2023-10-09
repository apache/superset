import { t } from '../translation';

export default function validateMaxValue(v: unknown, max: unknown) {
  if (typeof +max === 'number' && typeof +v === 'number' && +v > +max) {
    return t('Value cannot exceed %s', max);
  }
  return false;
}
