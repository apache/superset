/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { t } from '@superset-ui/translation';
import React from 'react';
import { Button, Nav, Navbar, MenuItem } from 'react-bootstrap';

interface Props {
  createButton: { name: string; url: string | null };
  canCreate: boolean;
  label: string;
  name: string;
  childs: Array<{ label: string; name: string; url: string }>;
}

interface State {
  selectedMenu: string;
}

class SubMenu extends React.PureComponent<Props, State> {
  state: State = {
    selectedMenu: this.props.childs[0] && this.props.childs[0].label,
  };
  handleClick = (item: string) => () => {
    this.setState({ selectedMenu: item });
  };

  render() {
    const { canCreate, childs, label, createButton } = this.props;

    return (
      <header className="top" id="secondary-menu">
        <Navbar inverse fluid role="navigation">
          <Navbar.Header>
            <Navbar.Brand>{t('%s', `${label}`)}</Navbar.Brand>
          </Navbar.Header>
          <Nav>
            {childs &&
              childs.map(child => (
                <MenuItem
                  active={child.label === this.state.selectedMenu}
                  key={`${child.label}`}
                  eventKey={`${child.name}`}
                  href={child.url}
                  onClick={this.handleClick(child.label)}
                >
                  {child.label}
                </MenuItem>
              ))}
          </Nav>
          {canCreate && (
            <Nav className="navbar-right">
              <Button href={`${createButton.url}`}>
                <i className="fa fa-plus" /> {t('%s', `${createButton.name}`)}
              </Button>
            </Nav>
          )}
        </Navbar>
      </header>
    );
  }
}

export default SubMenu;
