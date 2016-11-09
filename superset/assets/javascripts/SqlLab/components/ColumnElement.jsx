import React from 'react';

import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const propTypes = {
  column: React.PropTypes.object.isRequired,
};

const iconMap = {
  pk: 'fa-key',
  fk: 'fa-link',
  index: 'fa-bookmark',
};
const tooltipTitleMap = {
  pk: 'Primary Key',
  fk: 'Foreign Key',
  index: 'Index',
};

class ColumnElement extends React.PureComponent {
  render() {
    const col = this.props.column;
    let name = col.name;
    let icons;
    if (col.keys && col.keys.length > 0) {
      name = <strong>{col.name}</strong>;
      icons = col.keys.map((key, i) => (
        <span key={i} className="ColumnElement">
          <OverlayTrigger
            placement="right"
            overlay={
              <Tooltip id="idx-json" bsSize="lg">
                <strong>{tooltipTitleMap[key.type]}</strong>
                <hr />
                <pre className="text-small">
                  {JSON.stringify(key, null, '  ')}
                </pre>
              </Tooltip>
              }
          >
            <i className={`fa text-muted m-l-2 ${iconMap[key.type]}`} />
          </OverlayTrigger>
        </span>
      ));
    }
    return (
      <div className="clearfix table-column">
        <div className="pull-left m-l-10 col-name">
          {name}{icons}
        </div>
        <div className="pull-right text-muted">
          <small> {col.type}</small>
        </div>
      </div>);
  }
}
ColumnElement.propTypes = propTypes;

export default ColumnElement;
