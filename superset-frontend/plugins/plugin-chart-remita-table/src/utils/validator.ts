import { t } from '@superset-ui/core';

/**
 * Validates split actions configuration format
 */
export function validateSplitActions(value: string): string | false {
  if (!value) return false;

  const lines = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split('|').map(part => part.trim());

    // Validate format
    if (parts.length < 4) {
      return t('Line %d: Expected format key|label|boundToSelection|visibilityCondition', i + 1);
    }

    // Validate key
    if (!parts[0]?.trim()) {
      return t('Line %d: Key is required', i + 1);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(parts[0])) {
      return t('Line %d: Key must contain only letters, numbers, underscores, and hyphens', i + 1);
    }

    // Validate boundToSelection
    if (!['true', 'false'].includes(parts[2])) {
      return t('Line %d: boundToSelection must be true or false', i + 1);
    }

    // Validate visibilityCondition
    if (!['all', 'selected', 'unselected'].includes(parts[3])) {
      return t('Line %d: visibilityCondition must be all, selected, or unselected', i + 1);
    }
  }

  // Check for duplicate keys
  const keys = lines.map(line => line.split('|')[0].trim());
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicateKeys.length > 0) {
    return t('Duplicate action keys found: %s', [...new Set(duplicateKeys)].join(', '));
  }

  return false;
}

/**
 * Validates non-split actions configuration format
 */
export function validateNonSplitActions(value: string): string | false {
  if (!value) return false;

  const lines = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split('|').map(part => part.trim());

    // Validate format
    if (parts.length < 5) {
      return t('Line %d: Expected format key|label|style|boundToSelection|visibilityCondition', i + 1);
    }

    // Validate key
    if (!parts[0]?.trim()) {
      return t('Line %d: Key is required', i + 1);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(parts[0])) {
      return t('Line %d: Key must contain only letters, numbers, underscores, and hyphens', i + 1);
    }

    // Validate style
    if (!['default', 'primary', 'danger'].includes(parts[2])) {
      return t('Line %d: style must be default, primary, or danger', i + 1);
    }

    // Validate boundToSelection
    if (!['true', 'false'].includes(parts[3])) {
      return t('Line %d: boundToSelection must be true or false', i + 1);
    }

    // Validate visibilityCondition
    if (!['all', 'selected', 'unselected'].includes(parts[4])) {
      return t('Line %d: visibilityCondition must be all, selected, or unselected', i + 1);
    }
  }

  // Check for duplicate keys
  const keys = lines.map(line => line.split('|')[0].trim());
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicateKeys.length > 0) {
    return t('Duplicate action keys found: %s', [...new Set(duplicateKeys)].join(', '));
  }

  return false;
}
