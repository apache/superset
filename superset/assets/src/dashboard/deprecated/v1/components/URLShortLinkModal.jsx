import React from 'react';
import PropTypes from 'prop-types';
import ModalTrigger from '../../../../components/ModalTrigger';
import { t } from '../../../../locales';
import CopyToClipboard from '../../../../components/CopyToClipboard';
import { getShortUrl } from '../../../../utils/common';
import getDashboardLongUrl from '../../../util/getDashboardLongUrl';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  triggerNode: PropTypes.node.isRequired,
  filters: PropTypes.object.isRequired,
  emailPrefix: PropTypes.string.isRequired,
};

class URLShortLinkModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
    };
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  onShortUrlSuccess(data) {
    this.setState({
      shortUrl: data,
    });
  }

  getCopyUrl() {
    const longUrl = getDashboardLongUrl(
      this.props.dashboard,
      this.props.filters,
    );
    getShortUrl(longUrl, this.onShortUrlSuccess.bind(this));
  }

  render() {
    const { emailPrefix, triggerNode } = this.props;
    const { shortUrl } = this.state;

    const emailBody = `${emailPrefix} ${shortUrl}`;

    return (
      <ModalTrigger
        triggerNode={triggerNode}
        isMenuItem
        modalTitle={t('Shorten URL')}
        beforeOpen={this.getCopyUrl}
        modalBody={
          <div>
            <CopyToClipboard
              text={shortUrl}
              copyNode={
                <i className="fa fa-clipboard" title={t('Copy to clipboard')} />
              }
            />
            &nbsp;&nbsp;
            <a href={`mailto:?Subject=Superset%20Slice%20&Body=${emailBody}`}>
              <i className="fa fa-envelope" />
            </a>
          </div>
        }
      />
    );
  }
}
URLShortLinkModal.propTypes = propTypes;

export default URLShortLinkModal;
