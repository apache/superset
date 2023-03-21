import React, { useEffect, useState } from 'react';
import { Divider, List, Typography, Table } from 'antd';

export default function DataDisplay(props) {
  const {
    data
  } = props;

  const columns = data.length === 0 ? [] : Object.keys(data[0]).map(c => {
    return {
      title: c,
      dataIndex: c,
      key: c
    }
  });

  const [isEmpty, setIsEmpty] = useState(false);
  const [newData, setNewData] = useState([]);

  useEffect(() => {
    let nD = [];
    data.map((d, i) => {
      let row = {key: i};
      Object.keys(d).map(k => {
        row[k] = d[k]
      });
      nD.push(row);
    });
    setNewData([...nD]);
    setIsEmpty(data.length === 0);
  }, [data])

  return (
    <>
      {isEmpty ? 'No Data' : <Table columns={columns} dataSource={newData} /> }
    </>
  )
}
