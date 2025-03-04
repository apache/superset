import { SupersetError } from '@superset-ui/core';
import { useChartOwnerNames } from 'src/Superstructure/hooks/apiResources';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';

interface Props {
  chartId: string;
  error?: SupersetError;
}

/**
 * fetches the chart owners and adds them to the extra data of the error message
 */
export const ChartErrorMessage: React.FC<Props> = ({
  chartId,
  error,
  ...props
}) => {
  const { result: owners } = useChartOwnerNames(chartId);

  // don't mutate props
  const ownedError = error && {
    ...error,
    extra: { ...error.extra, owners },
  };

  return <ErrorMessageWithStackTrace {...props} error={ownedError} />;
};
