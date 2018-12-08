
import PropTypes from 'prop-types';
import React from 'react';
import TTestTable, { dataPropType } from './TTestTable';
import './PairedTTest.css';

const propTypes = {
  className: PropTypes.string,
  metrics: PropTypes.arrayOf(PropTypes.string).isRequired,
  groups: PropTypes.arrayOf(PropTypes.string).isRequired,
  data: PropTypes.objectOf(dataPropType).isRequired,
  alpha: PropTypes.number,
  liftValPrec: PropTypes.number,
  pValPrec: PropTypes.number,
};

const defaultProps = {
  className: '',
  alpha: 0.05,
  liftValPrec: 4,
  pValPrec: 6,
};

class PairedTTest extends React.PureComponent {
  render() {
    const {
      className,
      metrics,
      groups,
      data,
      alpha,
      pValPrec,
      liftValPrec,
    } = this.props;
    return (
      <div className={`paired-ttest-table scrollbar-container ${className}`}>
        <div className="scrollbar-content">
          {metrics.map((metric, i) => (
            <TTestTable
              key={i}
              metric={metric}
              groups={groups}
              data={data[metric]}
              alpha={alpha}
              pValPrec={Math.min(pValPrec, 32)}
              liftValPrec={Math.min(liftValPrec, 32)}
            />
          ))}
        </div>
      </div>
    );
  }
}

PairedTTest.propTypes = propTypes;
PairedTTest.defaultProps = defaultProps;

export default PairedTTest;
