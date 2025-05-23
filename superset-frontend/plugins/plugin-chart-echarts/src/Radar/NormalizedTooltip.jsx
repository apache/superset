/* eslint-disable import/no-extraneous-dependencies */
import ReactDOMServer from 'react-dom/server';
import { styled } from '@superset-ui/core';

const SeriesName = styled.div`
  font-weight: bold;
  margin-bottom: 5px;
`;

const MetricRow = styled.div`
  display: flex;
`;

const MetricLabel = styled.div`
  display: flex;
`;

const MetricValue = styled.div`
  font-weight: bold;
  margin-left: auto;
`;

const Dot = styled.span`
  margin-right: 5px;
  border-radius: 50%;
  width: 5px;
  height: 5px;
  align-self: center;
  background-color: ${({ color }) => color};
`;

const NormalizedTooltip = ({
  color,
  seriesName,
  metrics,
  values,
  getDenormalizedValue,
}) => (
  <div>
    <SeriesName>{seriesName || 'series0'}</SeriesName>
    {metrics.map((metric, index) => {
      const normalizedValue = values[index];
      const originalValue = getDenormalizedValue(
        seriesName,
        String(normalizedValue),
      );
      return (
        <MetricRow key={metric}>
          <MetricLabel>
            <Dot color={color} />
            {metric}:
          </MetricLabel>
          <MetricValue>{originalValue}</MetricValue>
        </MetricRow>
      );
    })}
  </div>
);

export const renderNormalizedTooltip = props =>
  ReactDOMServer.renderToStaticMarkup(<NormalizedTooltip {...props} />);
