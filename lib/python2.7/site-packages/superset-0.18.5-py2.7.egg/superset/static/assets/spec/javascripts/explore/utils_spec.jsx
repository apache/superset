import { it, describe } from 'mocha';
import { expect } from 'chai';
import URI from 'urijs';
import { getExploreUrl } from '../../../javascripts/explore/exploreUtils';

describe('utils', () => {
  const formData = {
    datasource: '1__table',
  };
  const sFormData = JSON.stringify(formData);
  function compareURI(uri1, uri2) {
    expect(uri1.toString()).to.equal(uri2.toString());
  }

  it('getExploreUrl generates proper base url', () => {
    // This assertion is to show clearly the value of location.href
    // in the context of unit tests.
    expect(location.href).to.equal('about:blank');

    compareURI(
        URI(getExploreUrl(formData, 'base', false, 'http://superset.com')),
        URI('/superset/explore/table/1/').search({ form_data: sFormData }),
    );
  });
  it('getExploreUrl generates proper json url', () => {
    compareURI(
        URI(getExploreUrl(formData, 'json', false, 'superset.com')),
        URI('/superset/explore_json/table/1/').search({ form_data: sFormData }),
    );
  });
  it('getExploreUrl generates proper json forced url', () => {
    compareURI(
        URI(getExploreUrl(formData, 'json', true, 'superset.com')),
        URI('/superset/explore_json/table/1/')
          .search({ form_data: sFormData, force: 'true' }),
    );
  });
  it('getExploreUrl generates proper csv URL', () => {
    compareURI(
        URI(getExploreUrl(formData, 'csv', false, 'superset.com')),
        URI('/superset/explore_json/table/1/')
          .search({ form_data: sFormData, csv: 'true' }),
    );
  });
  it('getExploreUrl generates proper standalone URL', () => {
    compareURI(
        URI(getExploreUrl(formData, 'standalone', false, 'superset.com')),
        URI('/superset/explore/table/1/')
          .search({ form_data: sFormData, standalone: 'true' }),
    );
  });
  it('getExploreUrl preserves main URLs params', () => {
    compareURI(
        URI(getExploreUrl(formData, 'json', false, 'superset.com?foo=bar')),
        URI('/superset/explore_json/table/1/')
          .search({ foo: 'bar', form_data: sFormData }),
    );
  });
});
