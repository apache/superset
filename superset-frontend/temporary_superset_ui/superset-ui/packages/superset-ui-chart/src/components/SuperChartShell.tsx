import React from 'react';
import SuperChart, { Props as SuperChartProps } from './SuperChart';
import ChartProps, { ChartPropsConfig } from '../models/ChartProps';

/** SuperChart Props for version 0.11 and below has chartProps */
type ClassicProps = Omit<
  SuperChartProps,
  | 'annotationData'
  | 'datasource'
  | 'filters'
  | 'formData'
  | 'payload'
  | 'onAddFilter'
  | 'onError'
  | 'setControlValue'
  | 'setTooltip'
  | 'width'
  | 'height'
> & {
  chartProps: ChartProps | ChartPropsConfig;
};

export type Props = ClassicProps | SuperChartProps;

const SuperChartShell = React.forwardRef<SuperChart, Props>((props, ref) => {
  if ('chartProps' in props) {
    const { chartProps, ...rest } = props;

    const {
      annotationData,
      datasource,
      filters,
      formData,
      payload,
      onAddFilter,
      onError,
      setControlValue,
      setTooltip,
      width,
      height,
    } = chartProps;

    return (
      <SuperChart
        ref={ref}
        {...rest}
        annotationData={annotationData}
        datasource={datasource}
        filters={filters}
        formData={formData}
        payload={payload}
        onAddFilter={onAddFilter}
        onError={onError}
        setControlValue={setControlValue}
        setTooltip={setTooltip}
        width={width}
        height={height}
      />
    );
  }

  return <SuperChart ref={ref} {...props} />;
});

export default SuperChartShell;
