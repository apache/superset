import { t } from '../translation';

/**
 * formerly called integer()
 * @param v
 */
export default function legacyValidateInteger(v: unknown) {
  if (v && (Number.isNaN(Number(v)) || parseInt(v as string, 10) !== Number(v))) {
    return t('is expected to be an integer');
  }
  return false;
}
