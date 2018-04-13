import React from 'react';

import CopyToClipboard from '../../components/CopyToClipboard';
import CopyQueryTabUrl from './CopyQueryTabUrl';
import Button from '../../components/Button';
import { t } from '../../locales';

export default class ShareQueryBtn extends CopyQueryTabUrl {
  render() {
    return (
      <CopyToClipboard
        copyNode={(
          <Button bsSize="small" className="toggleSave">
            <i className="fa fa-clipboard" /> {t('Share Query')}
          </Button>
      )}
        tooltipText={t('copy URL to clipboard')}
        shouldShowText={false}
        getText={this.getUrl.bind(this)}
      />);
  }
}
