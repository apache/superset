const internalProps = {
    hideTableHeader: true,
    column: true,
    columns: true,
    sortable: true,
    filterable: true,
    filtering: true,
    onFilter: true,
    filterPlaceholder: true,
    filterClassName: true,
    currentFilter: true,
    sort: true,
    sortBy: true,
    sortableColumns: true,
    onSort: true,
    defaultSort: true,
    defaultSortDescending: true,
    itemsPerPage: true,
    filterBy: true,
    hideFilterInput: true,
    noDataText: true,
    currentPage: true,
    onPageChange: true,
    previousPageLabel: true,
    nextPageLabel: true,
    pageButtonLimit: true,
    childNode: true,
    data: true,
    children: true
};

export function filterPropsFrom(baseProps) {
    baseProps = baseProps || {};
    var props = {};
    for (var key in baseProps) {
        if (!(key in internalProps)) {
            props[key] = baseProps[key];
        }
    }

    return props;
}

