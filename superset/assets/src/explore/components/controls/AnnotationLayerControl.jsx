import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover, ListGroup, ListGroupItem } from 'react-bootstrap';
import { connect } from 'react-redux';
import { getChartKey } from '../../exploreUtils';
import { runAnnotationQuery } from '../../../chart/chartAction';
import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';


import AnnotationLayer from './AnnotationLayer';
import { t } from '../../../locales';


const propTypes = {
  colorScheme: PropTypes.string.isRequired,
  annotationError: PropTypes.object,
  annotationQuery: PropTypes.object,
  vizType: PropTypes.string,

  validationErrors: PropTypes.array,
  name: PropTypes.string.isRequired,
  actions: PropTypes.object,
  value: PropTypes.arrayOf(PropTypes.object),
  onChange: PropTypes.func,
  refreshAnnotationData: PropTypes.func,
};

const defaultProps = {
  vizType: '',
  value: [],
  annotationError: {},
  annotationQuery: {},
  onChange: () => {},
};

class AnnotationLayerControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.addAnnotationLayer = this.addAnnotationLayer.bind(this);
    this.removeAnnotationLayer = this.removeAnnotationLayer.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const { name, annotationError, validationErrors, value } = nextProps;
    if (Object.keys(annotationError).length && !validationErrors.length) {
      this.props.actions.setControlValue(name, value, Object.keys(annotationError));
    }
    if (!Object.keys(annotationError).length && validationErrors.length) {
      this.props.actions.setControlValue(name, value, []);
    }
  }

  addAnnotationLayer(annotationLayer) {
    const annotation = annotationLayer;
    let annotations = this.props.value.slice();
    const i = annotations.findIndex(x => x.name === (annotation.oldName || annotation.name));
    delete annotation.oldName;
    if (i > -1) {
      annotations[i] = annotation;
    } else {
      annotations = annotations.concat(annotation);
    }
    this.props.refreshAnnotationData(annotation);
    this.props.onChange(annotations);
  }

  removeAnnotationLayer(annotation) {
    const annotations = this.props.value.slice()
      .filter(x => x.name !== annotation.oldName);
    this.props.onChange(annotations);
  }

  renderPopover(parent, annotation, error) {
    const id = !annotation ? '_new' : annotation.name;
    return (
      <Popover
        style={{ maxWidth: 'none' }}
        title={annotation ? 'Edit Annotation Layer' : 'Add Annotation Layer'}
        id={`annotation-pop-${id}`}
      >
        <AnnotationLayer
          {...annotation}
          error={error}
          colorScheme={this.props.colorScheme}
          vizType={this.props.vizType}
          addAnnotationLayer={this.addAnnotationLayer}
          removeAnnotationLayer={this.removeAnnotationLayer}
          close={() => this.refs[parent].hide()}
        />
      </Popover>
    );
  }

  renderInfo(anno) {
    const { annotationError, annotationQuery } = this.props;
    if (annotationQuery[anno.name]) {
      return (
        <i className="fa fa-refresh" style={{ color: 'orange' }} aria-hidden />
      );
    }
    if (annotationError[anno.name]) {
      return (
        <InfoTooltipWithTrigger
          label="validation-errors"
          bsStyle="danger"
          tooltip={annotationError[anno.name]}
        />
      );
    }
    if (!anno.show) {
      return <span style={{ color: 'red' }}> Hidden </span>;
    }
    return '';
  }

  render() {
    const annotations = this.props.value.map((anno, i) => (
      <OverlayTrigger
        key={i}
        trigger="click"
        rootClose
        ref={`overlay-${i}`}
        placement="right"
        overlay={this.renderPopover(`overlay-${i}`, anno,
          this.props.annotationError[anno.name])}
      >
        <ListGroupItem>
          <span>{anno.name}</span>
          <span style={{ float: 'right' }}>
            {this.renderInfo(anno)}
          </span>
        </ListGroupItem>
      </OverlayTrigger>
    ));
    return (
      <div>
        <ListGroup>
          {annotations}
          <OverlayTrigger
            trigger="click"
            rootClose
            ref="overlay-new"
            placement="right"
            overlay={this.renderPopover('overlay-new')}
          >
            <ListGroupItem>
              <i className="fa fa-plus" /> &nbsp; {t('Add Annotation Layer')}
            </ListGroupItem>
          </OverlayTrigger>
        </ListGroup>
      </div>
    );
  }
}

AnnotationLayerControl.propTypes = propTypes;
AnnotationLayerControl.defaultProps = defaultProps;

// Tried to hook this up through stores/control.jsx instead of using redux
// directly, could not figure out how to get access to the color_scheme
function mapStateToProps({ charts, explore }) {
  const chartKey = getChartKey(explore);
  return {
    colorScheme: (explore.controls || {}).color_scheme.value,
    annotationError: charts[chartKey].annotationError,
    annotationQuery: charts[chartKey].annotationQuery,
    vizType: explore.controls.viz_type.value,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    refreshAnnotationData: annotationLayer => dispatch(runAnnotationQuery(annotationLayer)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(AnnotationLayerControl);
