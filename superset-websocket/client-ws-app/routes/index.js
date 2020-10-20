const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const jwtSecret =  "test-secret-change-me";

/* GET home page. */
router.get('/', function(req, res, next) {
  let numTokens = req.query.sockets ? Number(req.query.sockets) : 100;
  let tokens = [];
  for(let i=0; i<numTokens; i++) {
    const token = jwt.sign({ channel: i }, jwtSecret);
    tokens.push(token);
  }

  res.render('index', { tokens: JSON.stringify(tokens) });
});

module.exports = router;
