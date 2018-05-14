import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';

import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/mode/json';
import 'brace/mode/html';
import 'brace/mode/markdown';
import 'brace/theme/textmate';

import ModalTrigger from '../../components/ModalTrigger';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import Button from '../../components/Button';
import { t } from '../../locales';

const propTypes = {
  onChange: PropTypes.func,
  code: PropTypes.string,
  language: PropTypes.oneOf(['yaml', 'json']),
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  code: '{}',
};

export default class TemplateParamsEditor extends React.Component {
  constructor(props) {
    super(props);
    const codeText = props.code || '{}';
    this.state = {
      codeText,
      parsedJSON: null,
      isValid: true,
    };
    this.onChange = this.onChange.bind(this);
  }
  componentDidMount() {
    this.onChange(this.state.codeText);
  }
  onChange(value) {
    const codeText = value;
    let isValid;
    let parsedJSON = {};
    try {
      parsedJSON = JSON.parse(value);
      isValid = true;
    } catch (e) {
      isValid = false;
    }
    this.setState({ parsedJSON, isValid, codeText });
    if (isValid) {
      this.props.onChange(codeText);
    } else {
      this.props.onChange('{}');
    }
  }
  renderDoc() {
    return (
      <p>
        Assign a set of parameters as <code>JSON</code> below
        (example: <code>{'{"my_table": "foo"}'}</code>),
        and they become available
        in your SQL (example: <code>SELECT * FROM {'{{ my_table }}'} </code>)
        by using
        <a
          href="http://superset.apache.org/sqllab.html#templating-with-jinja"
          target="_blank"
          rel="noopener noreferrer"
        >
          Jinja templating
        </a> syntax.
      </p>
    );
  }
  renderModalBody() {
    return (
      <div>
        {this.renderDoc()}
        <AceEditor
          mode={this.props.language}
          theme="textmate"
          style={{ border: '1px solid #CCC' }}
          minLines={25}
          maxLines={50}
          onChange={this.onChange}
          width="100%"
          editorProps={{ $blockScrolling: true }}
          enableLiveAutocompletion
          value={this.state.codeText}
        />
      </div>
    );
  }
  render() {
    const paramCount = this.state.parsedJSON ? Object.keys(this.state.parsedJSON).length : 0;
    return (
      <ModalTrigger
        modalTitle={t('Template Parameters')}
        triggerNode={
          <Button
            className="m-r-5"
            tooltip={t('Edit template parameters')}
          >
            {`${t('parameters')} `}
            {paramCount > 0 &&
              <Badge>{paramCount}</Badge>
            }
            {!this.state.isValid &&
              <InfoTooltipWithTrigger
                icon="exclamation-triangle"
                bsStyle="danger"
                tooltip={t('Invalid JSON')}
                label="invalid-json"
              />
            }
          </Button>
        }
        modalBody={this.renderModalBody(true)}
      />
    );
  }
}

TemplateParamsEditor.propTypes = propTypes;
TemplateParamsEditor.defaultProps = defaultProps;
