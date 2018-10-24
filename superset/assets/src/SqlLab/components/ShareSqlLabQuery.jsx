// import React from 'react';

// import CopyToClipboard from '../../components/CopyToClipboard';
// import CopyQueryTabUrl from './CopyQueryTabUrl';
// import Button from '../../components/Button';
// import { t } from '../../locales';
//
// export default class ShareQuery extends CopyQueryTabUrl {
//   render() {
//     return (
//       <CopyToClipboard
//         copyNode={(
//           <Button bsSize="small" className="toggleSave">
//             <i className="fa fa-clipboard" /> {t('Share Query')}
//           </Button>
//       )}
//         tooltipText={t('copy URL to clipboard')}
//         shouldShowText={false}
//         getText={this.getUrl}
//       />);
//   }
// }

import React from 'react';
import PropTypes from 'prop-types';
import { Popover, OverlayTrigger } from 'react-bootstrap';

import Button from '../../components/Button';
import CopyToClipboard from '../../components/CopyToClipboard';
import { storeQuery } from '../../utils/common';
import { t } from '../../locales';
import withToasts from '../../messageToasts/enhancers/withToasts';

const propTypes = {
  queryEditor: PropTypes.shape({
    dbId: PropTypes.number,
    title: PropTypes.string,
    schema: PropTypes.string,
    autorun: PropTypes.bool,
    sql: PropTypes.string,
  }).isRequired,
  addDangerToast: PropTypes.func.isRequired,
};

class ShareSqlLabQuery extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
      showOverlay: false,
    };
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  getCopyUrl() {
    const { dbId, title, schema, autorun, sql } = this.props.queryEditor;
    const sharedQuery = { dbId, title, schema, autorun, sql };

    storeQuery(sharedQuery)
      .then((shortUrl) => {
        this.setState({ shortUrl });
      })
      .catch(this.props.addDangerToast);
  }

  renderPopover() {
    return (
      <Popover key={Math.random()} id="sqllab-shareurl-popover">
        <CopyToClipboard
          text={this.state.shortUrl || 'Loading ...'}
          copyNode={<i className="fa fa-clipboard" title={t('Copy to clipboard')} />}
        />
      </Popover>
    );
  }

  render() {
    return (
      <OverlayTrigger
        trigger="click"
        placement="top"
        onEnter={this.getCopyUrl}
        rootClose
        shouldUpdatePosition
        overlay={this.renderPopover()}
      >
        <Button bsSize="small" className="toggleSave">
          <i className="fa fa-clipboard" /> {t('Share Query')}
        </Button>
      </OverlayTrigger>
    );
  }
}

ShareSqlLabQuery.propTypes = propTypes;

export default withToasts(ShareSqlLabQuery);
