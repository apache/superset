import { buildQueryContext, getChartBuildQueryRegistry, SupersetClient } from '@superset-ui/core';

const supersetClient = SupersetClient.getInstance();

export const CATEGORY_SUBJECT = 'category';
export const TAG_SUBJECT = 'tag';
export const OPERATOR_ID_EQUALS = 'EQUALS';

const COL = 'col';
const OP = 'op';
const VAL = 'val';

export function transformFilters(
  filters: { subject: string; operator: string; comparator: string }[],
) {
  return filters.map(filter => {
    const result: any = {};
    if (filter.subject) {
      result[COL] = filter.subject;
    }
    if (filter.operator) {
      result[OP] = filter.operator;
    }
    if (filter.comparator) {
      result[VAL] = filter.comparator;
    }
    return result;
  });
}

const buildReqestPayload = (formData: any) => {
  const buildQuery: any =
    getChartBuildQueryRegistry().get(formData.viz_type) ??
    ((buildQueryformData: any) =>
      buildQueryContext(buildQueryformData, baseQueryObject => {
        return [
          {
            ...baseQueryObject,
            filters: formData.filters,
          },
        ];
      }));

  return buildQuery(formData);
};

function createQuerySettings(payload: object) {
  return {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
    url: 'http://localhost:9000/api/v1/chart/data',
    body: JSON.stringify(payload),
  };
}

export function runCustomQuery(
  formData: any,
  firstFieldValue: string,
  secondFieldValue: string,
  firstColumn: string,
  secondColumn: string,
) {
  const { adhocFilters } = formData;

  const transformedFilters = transformFilters(adhocFilters);

  if (firstFieldValue) {
    transformedFilters.push({ col: firstColumn, op: '==', val: firstFieldValue });
  }
  if (secondFieldValue) {
    transformedFilters.push({ col: secondColumn, op: '==', val: secondFieldValue });
  }

  const customFormData = {
    ...formData,
    filters: transformedFilters,
  };

  const payload = buildReqestPayload(customFormData);
  const querySettings = createQuerySettings(payload);
  return supersetClient.post(querySettings);
}
