import URI from 'urijs';
import { getExploreUrlAndPayload, getExploreLongUrl } from '../../../src/explore/exploreUtils';

describe('exploreUtils', () => {
  const location = window.location;
  const formData = {
    datasource: '1__table',
  };
  const sFormData = JSON.stringify(formData);
  function compareURI(uri1, uri2) {
    expect(uri1.toString()).toBe(uri2.toString());
  }

  describe('getExploreUrlAndPayload', () => {
    it('generates proper base url', () => {
      // This assertion is to show clearly the value of location.href
      // in the context of unit tests.
      expect(location.href).toBe('http://localhost/');

      const { url, payload } = getExploreUrlAndPayload({
        formData,
        endpointType: 'base',
        force: false,
        curUrl: 'http://superset.com',
      });
      compareURI(
        URI(url),
        URI('/superset/explore/'),
      );
      expect(payload).toEqual(formData);
    });
    it('generates proper json url', () => {
      const { url, payload } = getExploreUrlAndPayload({
        formData,
        endpointType: 'json',
        force: false,
        curUrl: 'http://superset.com',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/'),
      );
      expect(payload).toEqual(formData);
    });
    it('generates proper json forced url', () => {
      const { url, payload } = getExploreUrlAndPayload({
        formData,
        endpointType: 'json',
        force: true,
        curUrl: 'superset.com',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/')
          .search({ force: 'true' }),
      );
      expect(payload).toEqual(formData);
    });
    it('generates proper csv URL', () => {
      const { url, payload } = getExploreUrlAndPayload({
        formData,
        endpointType: 'csv',
        force: false,
        curUrl: 'superset.com',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/')
          .search({ csv: 'true' }),
      );
      expect(payload).toEqual(formData);
    });
    it('generates proper standalone URL', () => {
      const { url, payload } = getExploreUrlAndPayload({
        formData,
        endpointType: 'standalone',
        force: false,
        curUrl: 'superset.com',
      });
      compareURI(
        URI(url),
        URI('/superset/explore/')
          .search({ standalone: 'true' }),
      );
      expect(payload).toEqual(formData);
    });
    it('preserves main URLs params', () => {
      const { url, payload } = getExploreUrlAndPayload({
        formData,
        endpointType: 'json',
        force: false,
        curUrl: 'superset.com?foo=bar',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/')
          .search({ foo: 'bar' }),
      );
      expect(payload).toEqual(formData);
    });
    it('generate proper save slice url', () => {
      const { url, payload } = getExploreUrlAndPayload({
        formData,
        endpointType: 'json',
        force: false,
        curUrl: 'superset.com?foo=bar',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/')
          .search({ foo: 'bar' }),
      );
      expect(payload).toEqual(formData);
    });
    it('generate proper saveas slice url', () => {
      const { url, payload } = getExploreUrlAndPayload({
        formData,
        endpointType: 'json',
        force: false,
        curUrl: 'superset.com?foo=bar',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/')
          .search({ foo: 'bar' }),
      );
      expect(payload).toEqual(formData);
    });
  });

  describe('getExploreLongUrl', () => {
    it('generates proper base url with form_data', () => {
      compareURI(
        URI(getExploreLongUrl(formData, 'base')),
        URI('/superset/explore/').search({ form_data: sFormData }),
      );
    });
  });
});
