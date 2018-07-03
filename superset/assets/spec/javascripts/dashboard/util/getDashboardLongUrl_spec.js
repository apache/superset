import { describe, it } from 'mocha';
import { expect } from 'chai';

import getDashboardLongUrl from '../../../../src/dashboard/util/getDashboardLongUrl';

describe('getDashboardLongUrl', () => {
  it('should return link to dashboard with slug preferred when available', () => {
    expect(getDashboardLongUrl({ id: 1, slug: 'slugName' }, {})).to.equal(
      '/superset/dashboard/slugName/?preselect_filters=%7B%7D',
    );
    expect(getDashboardLongUrl({ id: 1, slug: null }, {})).to.equal(
      '/superset/dashboard/1/?preselect_filters=%7B%7D',
    );
  });

  it('should include filters passed in', () => {
    expect(
      getDashboardLongUrl(
        { id: 1, slug: 'slugName' },
        { 13: { filterName: ['value1', 'value2'] } },
      ),
    ).to.equal(
      '/superset/dashboard/slugName/?preselect_filters=%7B%2213%22%3A%7B%22filterName%22%3A%5B%22value1%22%2C%22value2%22%5D%7D%7D',
    );
  });

  it('should return null when no dashboard is passed in', () => {
    expect(getDashboardLongUrl(null, {})).to.equal(null);
  });
});
