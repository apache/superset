import { QueryFields, QueryFieldAliases, FormDataResidual } from './types/QueryFormData';
/**
 * Extra SQL query related fields from chart form data.
 * Consolidate field values into arrays.
 *
 * @param formData - the (partial) form data obtained from chart controls.
 * @param aliases - additional field aliases that maps arbitrary field names to
 *                  query field names.
 */
export default function extractQueryFields(formData: FormDataResidual, aliases?: QueryFieldAliases): QueryFields;
//# sourceMappingURL=extractQueryFields.d.ts.map