import React from 'react';
import PropTypes from 'prop-types';
import { App, withParentSize } from '@data-ui/event-flow';
import { t } from '../../locales';

const propTypes = {
  className: PropTypes.string,
  data: PropTypes.array,
  initialMinEventCount: PropTypes.number,
};
const defaultProps = {
  className: '',
  data: null,
};

function isExplorer() {
  return (/explore/).test(window.location.pathname);
}

// The slice container overflows ~80px in explorer,
// so we have to correct for this.
const ResponsiveVis = withParentSize(({
  parentWidth,
  parentHeight,
  ...rest
}) => (
  <App
    width={parentWidth}
    height={parentHeight - (isExplorer() ? 80 : 0)}
    {...rest}
  />
));

function CustomEventFlow(props) {
  const { data, initialMinEventCount } = props;
  if (data) {
    return (
      <ResponsiveVis
        data={data}
        initialMinEventCount={initialMinEventCount}
      />
    );
  }
  return (
    <div>{t('Sorry, there appears to be no data')}</div>
  );
}

CustomEventFlow.propTypes = propTypes;
CustomEventFlow.defaultProps = defaultProps;

export default CustomEventFlow;
