import React from 'react';
import PropTypes from 'prop-types';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import CopyToClipboard from './../../components/CopyToClipboard';
import { getShortUrl } from '../../utils/common';
import { getDashboardLongUrl } from '../dashboardUtils';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  triggerNode: PropTypes.node.isRequired,
  filters: PropTypes.object.isRequired,
};

class URLShortLinkModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
    };
  }

  onShortUrlSuccess(data) {
    this.setState({
      shortUrl: data,
    });
  }

  getCopyUrl() {
    const longUrl = getDashboardLongUrl(this.props.dashboard, this.props.filters);
    getShortUrl(longUrl, this.onShortUrlSuccess.bind(this));
  }

  render() {
    const emailBody = t('Check out this dashboard: %s', this.state.shortUrl);

    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        isMenuItem
        modalTitle={t('Shorten URL')}
        beforeOpen={this.getCopyUrl.bind(this)}
        modalBody={
          <div>
            <CopyToClipboard
              text={this.state.shortUrl}
              copyNode={<i className="fa fa-clipboard" title={t('Copy to clipboard')} />}
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
