import React from 'react';

import ModalTrigger from '../../components/ModalTrigger';
import Select from 'react-select';

import AceEditor from 'react-ace';
import 'brace/mode/css';
import 'brace/theme/github';


const propTypes = {
  initialCss: React.PropTypes.string,
  triggerNode: React.PropTypes.node.isRequired,
  onChange: React.PropTypes.func,
  templates: React.PropTypes.array,
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
  componentWillMount() {
    this.updateDom();
  }
  changeCss(css) {
    this.setState({ css }, this.updateDom);
    this.props.onChange(css);
  }
  updateDom() {
    const css = this.state.css;
    const className = 'CssEditor-css';
    const head = document.head || document.getElementsByTagName('head')[0];
    let style = document.querySelector('.' + className);

    if (!style) {
      style = document.createElement('style');
      style.className = className;
      style.type = 'text/css';
      head.appendChild(style);
    }
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.innerHTML = css;
    }
  }
  changeCssTemplate(opt) {
    this.changeCss(opt.css);
  }
  renderTemplateSelector() {
    if (this.props.templates) {
      return (
        <div style={{ zIndex: 10 }}>
          <h5>Load a template</h5>
          <Select
            options={this.props.templates}
            placeholder="Load a CSS template"
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
        modalTitle="CSS"
        isButton
        modalBody={
          <div>
            {this.renderTemplateSelector()}
            <div style={{ zIndex: 1 }}>
              <h5>Live CSS Editor</h5>
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
                  value={this.state.css}
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
