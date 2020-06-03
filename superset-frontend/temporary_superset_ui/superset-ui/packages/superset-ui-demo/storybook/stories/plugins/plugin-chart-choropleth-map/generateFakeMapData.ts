import loadMap from '../../../../../../plugins/plugin-chart-choropleth-map/src/chart/loadMap';

const FRUITS = ['apple', 'banana', 'grape'];

export type FakeMapData = {
  key: string;
  favoriteFruit: string;
  numStudents: number;
}[];

/**
 * Generate mock data for the given map
 * Output is a promise of an array
 * { key, favoriteFruit, numStudents }[]
 * @param map map name
 */
export default async function generateFakeMapData(map: string) {
  const { object, metadata } = await loadMap(map);
  return object.features
    .map(f => metadata.keyAccessor(f))
    .map(key => ({
      key,
      favoriteFruit: FRUITS[Math.round(Math.random() * 2)],
      numStudents: Math.round(Math.random() * 100),
    }));
}
