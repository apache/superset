## @superset-ui/chart

[![Version](https://img.shields.io/npm/v/@superset-ui/chart.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/chart.svg?style=flat)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui.svg?path=packages%2Fsuperset-ui-chart&style=flat-square)](https://david-dm.org/apache-superset/superset-ui?path=packages/superset-ui-chart)

Description

#### Example usage

##### `<ChartDataProvider />`

This component is a React utility wrapper around the `@superset-ui/chart` `ChartClient` and will
generally require you to setup `CORS` (CROSS ORIGIN RESOURCE SHARING) to accept cross-origin
requests from domains outside your `Apache Superset` instance:

1. Configure `CORS` in your `Apache Superset` instance.

   a. Enable `CORS` requests to (minimally) the resources defined below.

   b. Enable `CORS` requests from the relevant domains (i.e., the app in which you will embed
   charts)

   ```python
   # config.py
   ENABLE_CORS = True
   CORS_OPTIONS = {
       'supports_credentials': True,
       'allow_headers': [
           'X-CSRFToken', 'Content-Type', 'Origin', 'X-Requested-With', 'Accept',
       ],
       'resources': [
            '/superset/csrf_token/'  # auth
            '/api/v1/formData/',  # sliceId => formData
            '/superset/explore_json/*',  # legacy query API, formData => queryData
            '/api/v1/query/',  # new query API, queryContext => queryData
            '/superset/fetch_datasource_metadata/'  # datasource metadata

       ],
       'origins': ['http://myappdomain:9001'],
   }
   ```

2. Configure `SupersetClient` in the app where you will embed your charts. You can test this
   configuration in the `@superset-ui` storybook.

   ```javascript
   import { SupersetClient } from '@superset-ui/connection';

   SupersetClient.configure({
     credentials: 'include',
     host: `${SUPERSET_APP_HOST}`,
     mode: 'cors',
   }).init();
   ```

3. Register any desired / needed `@superset-ui` chart + color plugins.

   ```javascript
   import WordCloudPlugin from '@superset-ui/plugin-chart-word-cloud';

   new WordCloudPlugin().configure({ key: 'word_cloud' }).register();
   ```

4. Pass `SupersetClient` to the `ChartDataProvider` along with the formData for the desired
   visualization type.

```javascript
import { ChartDataProvider } from '@superset-ui/chart';

const render = () => (
  <DataProvider client={client} formData={formData}>
    {({ loading, error, payload }) => (
      <>
        {loading && <Loader />}

        {error && <RenderError error={error} />}

        {payload && (
          <SuperChart type={CHART_TYPE} chartProps={{ formData, payload, width, height }} />
        )}
      </>
    )}
  </DataProvider>
);
```

##### `controls`

There are some helpers for plugin controls that can be imported from subdirectories of
`@superset-ui/chart`. If you're building a third-party plugin, modules that may be of use are
`@superset-ui/chart/controls/selectOptions` and `@superset-ui/chart/controls/D3Formatting`.

##### `<SuperChart />`

Coming soon.

### Development

`@data-ui/build-config` is used to manage the build configuration for this package including babel
builds, jest testing, eslint, and prettier.
