
CREATE TABLE slim_upload (
  id INTEGER NOT NULL,
  guid VARCHAR (65) NOT NULL,
  path VARCHAR (255) NOT NULL,
  name VARCHAR (125) NOT NULL,
  type VARCHAR (45) NOT NULL,
  status VARCHAR (45) NOT NULL,
  created_at DATETIME NOT NULL,
  created_by INTEGER NOT NULL,
  source VARCHAR(125) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (guid),
  FOREIGN KEY (created_by) REFERENCES ab_user (id)
);
