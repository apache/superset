import React from 'react';
import Link from '../../../javascripts/SqlLab/components/Link';
import { Button } from 'react-bootstrap';
import { TableElement } from '../../../javascripts/SqlLab/components/TableElement';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('TableElement', () => {

  const mockedProps = {
    'table': {
      "dbId": 1,
      "queryEditorId": "rJ-KP47a",
      "schema": "caravel",
      "name": "ab_user",
      "id": "r11Vgt60",
      "indexes": [
        {
          "unique": true,
          "column_names": [
            "username"
          ],
          "type": "UNIQUE",
          "name": "username"
        },
        {
          "unique": true,
          "column_names": [
            "email"
          ],
          "type": "UNIQUE",
          "name": "email"
        },
        {
          "unique": false,
          "column_names": [
            "created_by_fk"
          ],
          "name": "created_by_fk"
        },
        {
          "unique": false,
          "column_names": [
            "changed_by_fk"
          ],
          "name": "changed_by_fk"
        }
      ],
      "columns": [
        {
          "indexed": false,
          "longType": "INTEGER(11)",
          "type": "INTEGER",
          "name": "id"
        },
        {
          "indexed": false,
          "longType": "VARCHAR(64)",
          "type": "VARCHAR",
          "name": "first_name"
        },
        {
          "indexed": false,
          "longType": "VARCHAR(64)",
          "type": "VARCHAR",
          "name": "last_name"
        },
        {
          "indexed": true,
          "longType": "VARCHAR(64)",
          "type": "VARCHAR",
          "name": "username"
        },
        {
          "indexed": false,
          "longType": "VARCHAR(256)",
          "type": "VARCHAR",
          "name": "password"
        },
        {
          "indexed": false,
          "longType": "TINYINT(1)",
          "type": "TINYINT",
          "name": "active"
        },
        {
          "indexed": true,
          "longType": "VARCHAR(64)",
          "type": "VARCHAR",
          "name": "email"
        },
        {
          "indexed": false,
          "longType": "DATETIME",
          "type": "DATETIME",
          "name": "last_login"
        },
        {
          "indexed": false,
          "longType": "INTEGER(11)",
          "type": "INTEGER",
          "name": "login_count"
        },
        {
          "indexed": false,
          "longType": "INTEGER(11)",
          "type": "INTEGER",
          "name": "fail_login_count"
        },
        {
          "indexed": false,
          "longType": "DATETIME",
          "type": "DATETIME",
          "name": "created_on"
        },
        {
          "indexed": false,
          "longType": "DATETIME",
          "type": "DATETIME",
          "name": "changed_on"
        },
        {
          "indexed": true,
          "longType": "INTEGER(11)",
          "type": "INTEGER",
          "name": "created_by_fk"
        },
        {
          "indexed": true,
          "longType": "INTEGER(11)",
          "type": "INTEGER",
          "name": "changed_by_fk"
        }
      ],
      "expanded": true
    }
  }
  it('should just render', () => {
    expect(
      React.isValidElement(<TableElement />)
    ).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<TableElement {...mockedProps} />)
    ).to.equal(true);
  });
  it('has 3 Link elements', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find(Link)).to.have.length(3);
  });
  it('has 14 columns', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find('div.table-column')).to.have.length(14);
  });
});
