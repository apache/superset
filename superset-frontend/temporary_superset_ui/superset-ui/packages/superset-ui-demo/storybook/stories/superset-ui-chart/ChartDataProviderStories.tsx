import React from 'react';
import { text, select, withKnobs } from '@storybook/addon-knobs';

import { SuperChart, ChartDataProvider, SupersetClient } from '@superset-ui/core';
import { BigNumberChartPlugin as LegacyBigNumberPlugin } from '@superset-ui/legacy-preset-chart-big-number';
import LegacySankeyPlugin from '@superset-ui/legacy-plugin-chart-sankey';
import LegacySunburstPlugin from '@superset-ui/legacy-plugin-chart-sunburst';
import { WordCloudChartPlugin } from '@superset-ui/plugin-chart-word-cloud';

import {
  bigNumberFormData,
  sankeyFormData,
  sunburstFormData,
  wordCloudFormData,
} from '@superset-ui/core/test/chart/fixtures/formData';

import Expandable from '../../shared/components/Expandable';
import VerifyCORS, { renderError } from '../../shared/components/VerifyCORS';

const BIG_NUMBER = bigNumberFormData.viz_type;
const SANKEY = sankeyFormData.viz_type;
const SUNBURST = sunburstFormData.viz_type;
const WORD_CLOUD_LEGACY = wordCloudFormData.viz_type;
const WORD_CLOUD = 'new_word_cloud';

new LegacyBigNumberPlugin().configure({ key: BIG_NUMBER }).register();
// eslint-disable-next-line
new LegacySankeyPlugin().configure({ key: SANKEY }).register();
// eslint-disable-next-line
new LegacySunburstPlugin().configure({ key: SUNBURST }).register();
// eslint-disable-next-line
new WordCloudChartPlugin().configure({ key: WORD_CLOUD }).register();

const VIS_TYPES = [BIG_NUMBER, SANKEY, SUNBURST, WORD_CLOUD, WORD_CLOUD_LEGACY];
const FORM_DATA_LOOKUP = {
  [BIG_NUMBER]: bigNumberFormData,
  [SANKEY]: sankeyFormData,
  [SUNBURST]: sunburstFormData,
  [WORD_CLOUD]: { ...wordCloudFormData, viz_type: WORD_CLOUD },
  [WORD_CLOUD_LEGACY]: wordCloudFormData,
};

export default {
  title: 'Core / chart',
  decorators: [
    withKnobs({
      escapeHTML: false,
    }),
  ],
};

export const dataProvider = () => {
  const host = text('Set Superset App host for CORS request', 'localhost:8088');
  const visType = select('Chart Plugin Type', VIS_TYPES, VIS_TYPES[0]);
  const width = text('Vis width', '500');
  const height = text('Vis height', '300');
  const formData = text('Override formData', JSON.stringify(FORM_DATA_LOOKUP[visType]));

  return (
    <div style={{ margin: 16 }}>
      <VerifyCORS host={host}>
        {() => (
          <ChartDataProvider client={SupersetClient} formData={JSON.parse(formData)}>
            {({ loading, payload, error }) => {
              if (loading) return <div>Loading!</div>;

              if (error) return renderError(error);

              if (payload)
                return (
                  <>
                    <SuperChart
                      chartType={visType}
                      formData={payload.formData}
                      height={Number(height)}
                      // @TODO fix typing
                      // all vis's now expect objects but api/v1/ returns an array
                      queriesData={payload.queriesData}
                      width={Number(width)}
                    />
                    <br />
                    <Expandable expandableWhat="payload">
                      <pre style={{ fontSize: 11 }}>{JSON.stringify(payload, null, 2)}</pre>
                    </Expandable>
                  </>
                );

              return null;
            }}
          </ChartDataProvider>
        )}
      </VerifyCORS>
    </div>
  );
};

dataProvider.story = { name: 'ChartDataProvider' };
