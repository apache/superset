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
import React from 'react';
import styled from '@superset-ui/style';
import { Button, Nav, Navbar, MenuItem } from 'react-bootstrap';

const StyledHeader = styled.header`
  margin-top: -20px;
  .navbar-header .navbar-brand {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }

  .navbar-right {
    .btn-default {
      background-color: ${({ theme }) => theme.colors.primary.base};
      border-radius: 4px;
      border: none;
      color: ${({ theme }) => theme.colors.secondary.light5};
      font-size: ${({ theme }) => theme.typography.sizes.s};
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      margin: 8px 43px;
      padding: 8px 51px 8px 43px;
      text-transform: uppercase;
      i {
        padding: 4px ${({ theme }) => theme.typography.sizes.xs};
      }
    }
  }

  .navbar-nav {
    li {
      a {
        font-size: ${({ theme }) => theme.typography.sizes.s};
        padding: 8px;
        margin: 8px;
        color: ${({ theme }) => theme.colors.secondary.dark1};
      }
    }

    li.active > a,
    li > a:hover {
      background-color: ${({ theme }) => theme.colors.secondary.light4};
      border-bottom: none;
      border-radius: 4px;
    }
  }
`;

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
      <StyledHeader>
        <Navbar inverse fluid role="navigation">
          <Navbar.Header>
            <Navbar.Brand>{label}</Navbar.Brand>
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
                <i className="fa fa-plus" /> {createButton.name}
              </Button>
            </Nav>
          )}
        </Navbar>
      </StyledHeader>
    );
  }
}

export default SubMenu;
