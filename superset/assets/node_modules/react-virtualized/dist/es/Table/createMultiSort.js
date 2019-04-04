

export default function createMultiSort(sortCallback) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      defaultSortBy = _ref.defaultSortBy,
      _ref$defaultSortDirec = _ref.defaultSortDirection,
      defaultSortDirection = _ref$defaultSortDirec === undefined ? {} : _ref$defaultSortDirec;

  if (!sortCallback) {
    throw Error('Required parameter "sortCallback" not specified');
  }

  var sortBy = defaultSortBy || [];
  var sortDirection = {};

  sortBy.forEach(function (dataKey) {
    sortDirection[dataKey] = defaultSortDirection.hasOwnProperty(dataKey) ? defaultSortDirection[dataKey] : 'ASC';
  });

  function sort(_ref2) {
    var defaultSortDirection = _ref2.defaultSortDirection,
        event = _ref2.event,
        dataKey = _ref2.sortBy;

    if (event.shiftKey) {
      // Shift + click appends a column to existing criteria
      if (sortDirection.hasOwnProperty(dataKey)) {
        sortDirection[dataKey] = sortDirection[dataKey] === 'ASC' ? 'DESC' : 'ASC';
      } else {
        sortDirection[dataKey] = defaultSortDirection;
        sortBy.push(dataKey);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Control + click removes column from sort (if pressent)
      var index = sortBy.indexOf(dataKey);
      if (index >= 0) {
        sortBy.splice(index, 1);
        delete sortDirection[dataKey];
      }
    } else {
      sortBy.length = 0;
      sortBy.push(dataKey);

      if (sortDirection.hasOwnProperty(dataKey)) {
        sortDirection[dataKey] = sortDirection[dataKey] === 'ASC' ? 'DESC' : 'ASC';
      } else {
        sortDirection[dataKey] = defaultSortDirection;
      }
    }

    // Notify application code
    sortCallback({
      sortBy: sortBy,
      sortDirection: sortDirection
    });
  }

  return {
    sort: sort,
    sortBy: sortBy,
    sortDirection: sortDirection
  };
}