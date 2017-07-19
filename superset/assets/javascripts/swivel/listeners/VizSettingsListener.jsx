import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { updateFormData } from '../actions/vizSettingsActions';

const propTypes = {
  vizSettings: PropTypes.object.isRequired,
  updateFormData: PropTypes.func.isRequired,
};

/**
 * This renderless / headless component listens to the visualization state
 * (anything that requires that requires re-rendering the charts without
 * running a query)
 */
class VizSettingsListener extends PureComponent {
  constructor(props) {
    super(props);
    this.update = this.update.bind(this);
  }
  componentDidMount() { this.update(); }
  componentDidUpdate() { this.update(); }

  update() {
    this.props.updateFormData(this.props.vizSettings);
  }

  render() { return null; }
}

VizSettingsListener.propTypes = propTypes;

const mapStateToProps = state => ({
  vizSettings: state.settings.present.viz,
});

const mapDispatchToProps = dispatch => ({
  updateFormData: vizSettings => dispatch(updateFormData(vizSettings)),
});

export default connect(mapStateToProps, mapDispatchToProps)(VizSettingsListener);
