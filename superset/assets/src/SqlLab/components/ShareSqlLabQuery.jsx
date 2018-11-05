import React from 'react';
import PropTypes from 'prop-types';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import Button from '../../components/Button';
import CopyToClipboard from '../../components/CopyToClipboard';
import { storeQuery } from '../../utils/common';
import getClientErrorObject from '../../utils/getClientErrorObject';
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
      shortUrl: 'Loading ...',
      showOverlay: false,
    };
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  getCopyUrl() {
    const { dbId, title, schema, autorun, sql } = this.props.queryEditor;
    const sharedQuery = { dbId, title, schema, autorun, sql };

    return storeQuery(sharedQuery)
      .then((shortUrl) => {
        this.setState({ shortUrl });
      })
      .catch((response) => {
        getClientErrorObject(response)
          .then(({ error }) => {
            this.props.addDangerToast(error);
            this.setState({ shortUrl: t('Error') });
          });
      });
  }

  renderPopover() {
    return (
      <Popover id="sqllab-shareurl-popover">
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
