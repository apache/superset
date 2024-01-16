import { t } from '../translation';

export default function validateMaxValue(v: unknown, max: Number) {
  if (Number(v) > +max) {
    return t('Value cannot exceed %s', max);
  }
  return false;
}
