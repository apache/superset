import React from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';
import CopyToClipboard from './CopyToClipboard';
import { getShortUrl } from '../utils/common';
import withToasts from '../messageToasts/enhancers/withToasts';
import ModalTrigger from './ModalTrigger';

const propTypes = {
  url: PropTypes.string,
  emailSubject: PropTypes.string,
  emailContent: PropTypes.string,
  addDangerToast: PropTypes.func.isRequired,
  isMenuItem: PropTypes.bool,
  triggerNode: PropTypes.node.isRequired,
};

class URLShortLinkModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
    };
    this.modal = null;
    this.setModalRef = this.setModalRef.bind(this);
    this.onShortUrlSuccess = this.onShortUrlSuccess.bind(this);
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  onShortUrlSuccess(shortUrl) {
    this.setState(() => ({ shortUrl }));
  }

  setModalRef(ref) {
    this.modal = ref;
  }

  getCopyUrl() {
    getShortUrl(this.props.url).then(this.onShortUrlSuccess).catch(this.props.addDangerToast);
  }

  render() {
    const emailBody = t('%s%s', this.props.emailContent, this.state.shortUrl);
    return (
      <ModalTrigger
        ref={this.setModalRef}
        isMenuItem={this.props.isMenuItem}
        triggerNode={this.props.triggerNode}
        beforeOpen={this.getCopyUrl}
        modalTitle={t('Share Dashboard')}
        modalBody={
          <div>
            <CopyToClipboard
              text={this.state.shortUrl}
              copyNode={<i className="fa fa-clipboard" title={t('Copy to clipboard')} />}
            />
            &nbsp;&nbsp;
            <a href={`mailto:?Subject=${this.props.emailSubject}%20&Body=${emailBody}`}>
              <i className="fa fa-envelope" />
            </a>
          </div>
        }
      />
    );
  }
}

URLShortLinkModal.defaultProps = {
  url: window.location.href.substring(window.location.origin.length),
  emailSubject: '',
  emailContent: '',
};

URLShortLinkModal.propTypes = propTypes;

export default withToasts(URLShortLinkModal);
