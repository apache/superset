import React, { useEffect, useState } from 'react';

export default function DataDisplay(props) {
  const {
    data
  } = props;

  return (
    <ul>
      {Object.keys(data).map((k, i) => (
        <li key={i}>
          {`${k}: ${data[k]}`}
        </li>
      ))}
    </ul>
  )
}