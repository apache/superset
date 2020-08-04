import useQueryParams from './useQueryParams';
export var QueryParams = function (_a) {
    var config = _a.config, children = _a.children;
    var _b = useQueryParams(config), query = _b[0], setQuery = _b[1];
    return children({ query: query, setQuery: setQuery });
};
export default QueryParams;
