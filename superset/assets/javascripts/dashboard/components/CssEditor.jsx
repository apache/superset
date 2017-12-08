import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';

import AceEditor from 'react-ace';
import 'brace/mode/css';
import 'brace/theme/github';

import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

const propTypes = {
  initialCss: PropTypes.string,
  triggerNode: PropTypes.node.isRequired,
  onChange: PropTypes.func,
  templates: PropTypes.array,
};

const defaultProps = {
  initialCss: '',
  onChange: () => {},
  templates: [],
};

class CssEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      css: props.initialCss,
      cssTemplateOptions: [],
    };
  }
  changeCss(css) {
    this.setState({ css }, () => {
      this.props.onChange(css);
    });
  }
  changeCssTemplate(opt) {
    this.changeCss(opt.css);
  }
  renderTemplateSelector() {
    if (this.props.templates) {
      return (
        <div style={{ zIndex: 10 }}>
          <h5>{t('Load a template')}</h5>
          <Select
            options={this.props.templates}
            placeholder={t('Load a CSS template')}
            onChange={this.changeCssTemplate.bind(this)}
          />
        </div>
      );
    }
    return null;
  }
  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        modalTitle={t('CSS')}
        isMenuItem
        modalBody={
          <div>
            {this.renderTemplateSelector()}
            <div style={{ zIndex: 1 }}>
              <h5>{t('Live CSS Editor')}</h5>
              <div style={{ border: 'solid 1px grey' }}>
                <AceEditor
                  mode="css"
                  theme="github"
                  minLines={8}
                  maxLines={30}
                  onChange={this.changeCss.bind(this)}
                  height="200px"
                  width="100%"
                  editorProps={{ $blockScrolling: true }}
                  enableLiveAutocompletion
                  value={this.state.css || ''}
                />
              </div>
            </div>
          </div>
        }
      />
    );
  }
}
CssEditor.propTypes = propTypes;
CssEditor.defaultProps = defaultProps;

export default CssEditor;
