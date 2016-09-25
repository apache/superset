import React, { PropTypes } from 'react';

const propTypes = {
  faves: PropTypes.array.isRequired,
};

export default function FavesTable ({ faves }) {
  const rows = faves.map((fave) => {
    const url = `/caravel/${fave.class_name}/${fave.obj_id}`;
    return (
      <tr key={fave.class_name + fave.obj_id}>
        <td><a href={url}>{fave.class_name} {fave.obj_id}</a></td>
      </tr>
    );
  });
  const hasFaves = faves.length > 0;

  return (
    <div>
      <table className="table" style={{display: 'table', width: '100%'}}>
        <tbody>
          {!hasFaves &&
            <tr>
              <td>You don't have any favorites yet.</td>
            </tr>
          }
          {rows}
        </tbody>
      </table>
    </div>
  );
}

FavesTable.propTypes = propTypes;
