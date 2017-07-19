import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { updateFormDataAndRunQuery } from '../actions/querySettingsActions';
import { setOutdated } from '../actions/vizDataActions';

const propTypes = {
  run: PropTypes.bool.isRequired,
  settings: PropTypes.object.isRequired,

  updateAndRun: PropTypes.func.isRequired,
  handleOutdated: PropTypes.func.isRequired,
};

/**
 * This renderless / headless component listens to the query state
 * (anything that requires running a query)
 * and will either run the query or mark the current data as outdated
 */
class QuerySettingsListener extends PureComponent {
  constructor(props) {
    super(props);
    this.update = this.update.bind(this);
  }

  componentDidMount(prevProps) { this.update(prevProps); }
  componentDidUpdate() { this.update(); }

  update(prevProps) {
    const { run, settings, updateAndRun, handleOutdated } = this.props;
    if (run && settings.datasource) {
      updateAndRun(settings);
    } else if (!prevProps || run !== prevProps.run) {
      // don't mark chart outdated if only 'run' changed
      handleOutdated();
    }
  }

  render() { return null; }
}

QuerySettingsListener.propTypes = propTypes;

const mapStateToProps = state => ({
  settings: state.settings.present.query,
  run: state.controls.run,
});

const mapDispatchToProps = dispatch => ({
  updateAndRun: (settings) => {
    dispatch(updateFormDataAndRunQuery(settings));
  },
  handleOutdated: () => {
    dispatch(setOutdated(true));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(QuerySettingsListener);
