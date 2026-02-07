export const BLOCKED_JSON_KEYS: string[] = [
  // Identity / structural
  'viz_type',
  'datasource',
  'datasource_id',
  'datasource_name',
  'datasource_type',
  'datasource_uid',
  'datasource_uuid',
  'slice_id',
  'slice_name',
  // Self-reference of this control to avoid recursion
  'json_config_manager',
];

export function isBlockedJsonKey(key: string): boolean {
  return BLOCKED_JSON_KEYS.includes(key);
}

export function sanitizeImportedConfig<T extends Record<string, any>>(obj: T): T {
  // Return a shallow clone without blocked keys
  const out: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  BLOCKED_JSON_KEYS.forEach(k => {
    if (k in out) delete out[k];
  });
  return out as T;
}

