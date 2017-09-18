import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, FormControl } from 'react-bootstrap';

import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/mode/json';
import 'brace/mode/html';
import 'brace/mode/markdown';

import 'brace/theme/textmate';

import ControlHeader from '../ControlHeader';
import ModalTrigger from '../../../components/ModalTrigger';

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.string,
  height: PropTypes.number,
  language: PropTypes.oneOf([null, 'json', 'html', 'sql', 'markdown']),
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  value: '',
  height: 250,
};

export default class TextAreaControl extends React.Component {
  onControlChange(event) {
    this.props.onChange(event.target.value);
  }
  onAceChange(value) {
    this.props.onChange(value);
  }
  renderEditor(inModal = false) {
    if (this.props.language) {
      return (
        <AceEditor
          mode={this.props.language}
          theme="textmate"
          style={{ border: '1px solid #CCC' }}
          minLines={inModal ? 40 : 10}
          maxLines={inModal ? 1000 : 10}
          onChange={this.onAceChange.bind(this)}
          width="100%"
          editorProps={{ $blockScrolling: true }}
          enableLiveAutocompletion
          value={this.props.value}
        />
      );
    }
    return (
      <FormGroup controlId="formControlsTextarea">
        <FormControl
          componentClass="textarea"
          placeholder="textarea"
          onChange={this.onControlChange.bind(this)}
          value={this.props.value}
          style={{ height: this.props.height }}
        />
      </FormGroup>);
  }
  render() {
    const controlHeader = <ControlHeader {...this.props} />;
    return (
      <div>
        {controlHeader}
        {this.renderEditor()}
        <ModalTrigger
          bsSize="large"
          modalTitle={controlHeader}
          triggerNode={
            <Button bsSize="small" className="m-t-5">
              Edit <strong>{this.props.language}</strong> in modal
            </Button>
          }
          modalBody={this.renderEditor(true)}
        />
      </div>
    );
  }
}

TextAreaControl.propTypes = propTypes;
TextAreaControl.defaultProps = defaultProps;
