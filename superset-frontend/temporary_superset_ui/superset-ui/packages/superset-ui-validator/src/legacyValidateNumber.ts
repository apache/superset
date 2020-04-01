import { t } from '@superset-ui/translation';

/**
 * formerly called numeric()
 * @param v
 */
export default function numeric(v: unknown) {
  if (v && isNaN(v as number)) {
    return t('is expected to be a number');
  }
  return false;
}
