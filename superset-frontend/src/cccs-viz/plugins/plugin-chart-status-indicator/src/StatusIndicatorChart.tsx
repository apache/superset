import React from 'react';
import { styled, SafeMarkdown } from '@superset-ui/core';
import { ChartProps } from './types';


const Container = styled.div`
  display: flex;
  justify-content: space-between;
`;

const Chart = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

export default function StatusIndicatorChart(chartProps: ChartProps) {
  const {
    markdowns,
    backgroundColors,
    textColor,
    orientation,
    roundedCorners,
    height,
    width,
  } = chartProps;

  return (
    <Container
      style={{
        height: height,
        width: width,
        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
      }}
    >
      {markdowns.map((markdown, index) => (
        <Chart
          style={{
            backgroundColor: backgroundColors[index],
            borderRadius: roundedCorners ? '0.5em' : 0,
            color: textColor === 'light' ? 'gainsboro' : '#404040',
            marginBottom: orientation === 'horizontal' ? 0 : 10,
            marginRight: orientation === 'horizontal' ? 10 : 0,
          }}
        >
          <SafeMarkdown source={markdown} />
        </Chart>
      ))}
    </Container>
  );
}
