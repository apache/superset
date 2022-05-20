import {
  isSimpleAdhocFilter,
  isSetAdhocFilter,
  SetAdhocFilter,
  styled,
} from '@superset-ui/core';

export function getSearchKeywords(filterName: string): any {
  if (filterName == 'ip_string') {
    return ['IPV4', 'IPV4_FILTER'];
  }
  return [];
}

export function getSelectedFilterName(formData: any): string {
  let filterName = '';
  if (formData.extraFormData?.filters?.length > 0) {
    const filter = formData.extraFormData.filters[0];
    filterName = filter.col;
  } else if (formData.adhocFilters?.length > 0) {
    const filter = formData.adhocFilters[0];
    if (isSimpleAdhocFilter(filter) && isSetAdhocFilter(filter)) {
      const f = filter as SetAdhocFilter;
      filterName = f.subject;
    }
  }
  return filterName;
}

export function getSelectedValues(formData: any): string[] {
  let selected_values = [];
  if (formData.extraFormData?.filters?.length > 0) {
    const filter = formData.extraFormData.filters[0];
    selected_values = Array.isArray(filter.val) ? filter.val : [filter.val];
  } else if (formData.adhocFilters?.length > 0) {
    const filter = formData.adhocFilters[0];
    if (isSimpleAdhocFilter(filter) && isSetAdhocFilter(filter)) {
      const f = filter as SetAdhocFilter;
      selected_values = Array.isArray(f.comparator)
        ? f.comparator
        : [f.comparator];
    }
  }
  return selected_values;
}

export const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: left;
  justify-content: left;
  overflow-y: auto;
`;

export const Table = styled.table`
  border-collapse: collapse;
  height: 90%;
  width: 100%;
  overflow-y: auto;
`;

export const Td = styled.td`
  padding: 5px;
  text-align: left;
  border-bottom: 1px solid #ddd;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 1px;
`;

export const Tr = styled.tr`
  &:hover {
    background: #f5f5f5;
  }
`;
