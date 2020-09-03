import React from 'react';
import { Select } from 'antd';
import querystring from 'querystring';

const { Option } = Select;

const versions = ['1', '2'];

export default function VersionSelect() {
  const { version } = querystring.parse(window.location.search.substr(1));
  const handleChange = (e) => {
    // @ts-ignore
    window.location = `/docs/intro?version=${e}`;
  };
  return (
    <div>
      version:
      <Select defaultValue={version || 1} style={{ width: 120 }} onChange={handleChange}>
        {versions.map((e) => (
          <Option value={e}>{e}</Option>
        ))}
      </Select>
    </div>
  );
}
