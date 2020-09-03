import { t } from '../translation';

export default function validateInteger(v: unknown) {
  if (
    (typeof v === 'string' && v.trim().length > 0 && Number.isFinite(Number(v.trim()))) ||
    (typeof v === 'number' && Number.isFinite(v))
  ) {
    return false;
  }

  return t('is expected to be a number');
}
