// DODO was here
import { Component, createRef } from 'react';
import PropTypes from 'prop-types';
import { TextArea } from 'src/components/Input';
import { t, withTheme } from '@superset-ui/core';

import Button from 'src/components/Button';
import { TextAreaEditor } from 'src/components/AsyncAceEditor';
import ModalTrigger from 'src/components/ModalTrigger';

import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  initialValue: PropTypes.string,
  height: PropTypes.number,
  minLines: PropTypes.number,
  maxLines: PropTypes.number,
  offerEditInModal: PropTypes.bool,
  language: PropTypes.oneOf([
    null,
    'json',
    'html',
    'sql',
    'markdown',
    'javascript',
  ]),
  aboveEditorSection: PropTypes.node,
  readOnly: PropTypes.bool,
  resize: PropTypes.oneOf([
    null,
    'block',
    'both',
    'horizontal',
    'inline',
    'none',
    'vertical',
  ]),
  textAreaStyles: PropTypes.object,
};

const defaultProps = {
  onChange: () => {},
  initialValue: '',
  height: 250,
  minLines: 3,
  maxLines: 10,
  offerEditInModal: true,
  readOnly: false,
  resize: null,
  textAreaStyles: {},
};

class TextAreaControl extends Component {
  // DODO added start 45047288
  constructor(props) {
    super(props);
    this.editorContainerRef = createRef();
    this.state = {
      height: this.props.height || defaultProps.height,
    };
    this.hasVerticalResize = ['auto', 'both', 'vertical', 'block'].includes(
      this.props.resize ?? '',
    );
  }

  componentWillUnmount() {
    if (this.resizeObserver && this.editorContainerRef.current) {
      this.resizeObserver.unobserve(this.editorContainerRef.current);
    }
  }

  setupResizeObserver = () => {
    const container = this.editorContainerRef.current;
    if (this.hasVerticalResize && container) {
      let resizeTimeout;

      this.resizeObserver = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const { height } = container.getBoundingClientRect();
          this.setState({ height });
        }, 200);
      });

      this.resizeObserver.observe(container);
    }
  };
  // DODO added stop 45047288

  onControlChange(event) {
    const { value } = event.target;
    this.props.onChange(value);
  }

  onAreaEditorChange(value) {
    this.props.onChange(value);
  }

  renderEditor(inModal = false) {
    const minLines = inModal ? 40 : this.props.minLines || 12;
    if (this.props.language) {
      const style = {
        border: `1px solid ${this.props.theme.colors.grayscale.light1}`,
        minHeight: `${minLines}em`,
        width: 'auto',
        ...this.props.textAreaStyles,
      };
      if (this.props.resize) {
        style.resize = this.props.resize;
      }
      if (this.props.readOnly) {
        style.backgroundColor = '#f2f2f2';
      }

      return (
        <TextAreaEditor
          mode={this.props.language}
          style={style}
          minLines={minLines}
          maxLines={inModal ? 1000 : this.props.maxLines}
          editorProps={{ $blockScrolling: true }}
          defaultValue={this.props.initialValue}
          readOnly={this.props.readOnly}
          key={this.props.name}
          {...this.props}
          onChange={this.onAreaEditorChange.bind(this)}
          // DODO added start 45047288
          height={this.state.height}
          hasVerticalResize={this.hasVerticalResize}
          onLoad={editor => {
            if (editor.renderer.container) {
              this.editorContainerRef.current = editor.renderer.container;
              this.setupResizeObserver();
            }
          }}
          // DODO added stop 45047288
        />
      );
    }
    return (
      <TextArea
        placeholder={t('textarea')}
        onChange={this.onControlChange.bind(this)}
        defaultValue={this.props.initialValue}
        disabled={this.props.readOnly}
        style={{ height: this.props.height }}
      />
    );
  }

  renderModalBody() {
    return (
      <>
        <div>{this.props.aboveEditorSection}</div>
        {this.renderEditor(true)}
      </>
    );
  }

  render() {
    const controlHeader = <ControlHeader {...this.props} />;
    return (
      <div>
        {controlHeader}
        {this.renderEditor()}
        {this.props.offerEditInModal && (
          <ModalTrigger
            modalTitle={controlHeader}
            triggerNode={
              <Button buttonSize="small" className="m-t-5">
                {t('Edit')} <strong>{this.props.language}</strong>{' '}
                {t('in modal')}
              </Button>
            }
            modalBody={this.renderModalBody(true)}
            responsive
          />
        )}
      </div>
    );
  }
}

TextAreaControl.propTypes = propTypes;
TextAreaControl.defaultProps = defaultProps;

export default withTheme(TextAreaControl);
