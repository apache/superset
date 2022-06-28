import { getParsedExploreURLParams } from './getParsedExploreURLParams';

const setupLocation = (newUrl: string) => {
  delete (window as any).location;
  // @ts-ignore
  window.location = new URL(newUrl);
};

test('get form_data_key and slice_id from search params - url when moving from dashboard to explore', () => {
  setupLocation(
    'http://localhost:9000/superset/explore/?form_data_key=yrLXmyE9fmhQ11lM1KgaD1PoPSBpuLZIJfqdyIdw9GoBwhPFRZHeIgeFiNZljbpd&slice_id=56',
  );
  expect(getParsedExploreURLParams()).toEqual(
    'slice_id=56&form_data_key=yrLXmyE9fmhQ11lM1KgaD1PoPSBpuLZIJfqdyIdw9GoBwhPFRZHeIgeFiNZljbpd',
  );
});

test('get slice_id from form_data search param - url on Chart List', () => {
  setupLocation(
    'http://localhost:9000/superset/explore/?form_data=%7B%22slice_id%22%3A%2056%7D',
  );
  expect(getParsedExploreURLParams()).toEqual('slice_id=56');
});

test('get permalink key from path params', () => {
  setupLocation('http://localhost:9000/superset/dashboard/p/kpOqweaMY9R/');
  expect(getParsedExploreURLParams()).toEqual('permalink_key=kpOqweaMY9R');
});
