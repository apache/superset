import React, { ReactNode } from 'react';

export type Props = {
  children: ReactNode;
  expandableWhat?: string;
};

type State = {
  open: boolean;
};

export default class Expandable extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { open: false };
    this.handleToggle = this.handleToggle.bind(this);
  }

  handleToggle() {
    this.setState(({ open }) => ({ open: !open }));
  }

  render() {
    const { open } = this.state;
    const { children, expandableWhat } = this.props;

    return (
      <div>
        <button type="button" className="btn btn-primary btn-sm" onClick={this.handleToggle}>
          {`${open ? 'Hide' : 'Show'} ${expandableWhat}`}
        </button>
        <br />
        <br />
        {open ? children : null}
      </div>
    );
  }
}
