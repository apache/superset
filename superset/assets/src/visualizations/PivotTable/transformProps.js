export default function transformProps(a) {
  const b = a.height;
  const c = a.datasource;
  const d = a.formData;
  const e = a.queryData;
  const f = d.groupby;
  const g = d.numberFormat;
  const h = c.columnFormats;
  const i = c.verboseMap;
  return {
    height: b,
    data: e.data,
    columnFormats: h,
    numGroups: f.length,
    numberFormat: g,
    verboseMap: i,
  };
}
