import { connect } from 'react-redux';
import { setVizType } from '../actions/querySettingsActions';
import LabeledSelect from '../components/LabeledSelect';

const mapStateToProps = state => ({
  title: 'Visualisation Type',
  options: state.refData.viz_types.map(({ name, id }) => ({ value: id, label: name })),
  value: state.settings.present.query.vizType,
});

const mapDispatchToProps = dispatch => ({
  onChange: (vizType) => {
    dispatch(setVizType(vizType.value));
  },
});

const VizTypeSelect = connect(
    mapStateToProps,
    mapDispatchToProps,
)(LabeledSelect);

export default VizTypeSelect;
