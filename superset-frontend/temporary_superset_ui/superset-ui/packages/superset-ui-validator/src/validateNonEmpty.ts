import { t } from '@superset-ui/translation';

export default function validateNonEmpty(v: unknown) {
  if (v === null || typeof v === 'undefined' || v === '' || (Array.isArray(v) && v.length === 0)) {
    return t('cannot be empty');
  }
  return false;
}
