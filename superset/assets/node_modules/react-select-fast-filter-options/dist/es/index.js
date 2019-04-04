import { AllSubstringsIndexStrategy, Search, UnorderedSearchIndex } from 'js-search';

export default function createFilterOptions(_ref) {
  var indexes = _ref.indexes,
      indexStrategy = _ref.indexStrategy,
      _ref$labelKey = _ref.labelKey,
      labelKey = _ref$labelKey === undefined ? 'label' : _ref$labelKey,
      _ref$options = _ref.options,
      options = _ref$options === undefined ? [] : _ref$options,
      sanitizer = _ref.sanitizer,
      searchIndex = _ref.searchIndex,
      tokenizer = _ref.tokenizer,
      _ref$valueKey = _ref.valueKey,
      valueKey = _ref$valueKey === undefined ? 'value' : _ref$valueKey;

  var search = new Search(valueKey);
  search.searchIndex = searchIndex || new UnorderedSearchIndex();
  search.indexStrategy = indexStrategy || new AllSubstringsIndexStrategy();

  if (sanitizer) {
    search.sanitizer = sanitizer;
  }

  if (tokenizer) {
    search.tokenizer = tokenizer;
  }

  if (indexes) {
    indexes.forEach(function (index) {
      search.addIndex(index);
    });
  } else {
    search.addIndex(labelKey);
  }

  search.addDocuments(options);

  // See https://github.com/JedWatson/react-select/blob/e19bce383a8fd1694278de47b6d00a608ea99f2d/src/Select.js#L830
  // See https://github.com/JedWatson/react-select#advanced-filters
  return function filterOptions(options, filter, selectedOptions) {
    var filtered = filter ? search.search(filter) : options;

    if (Array.isArray(selectedOptions) && selectedOptions.length) {
      var selectedValues = selectedOptions.map(function (option) {
        return option[valueKey];
      });

      return filtered.filter(function (option) {
        return !selectedValues.includes(option[valueKey]);
      });
    }

    return filtered;
  };
}