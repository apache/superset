const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

let server;
let calls = 0;
let responses = [];

app.post('/mock', (req, res) => {
  responses = req.body;
  calls = 0;
  res.status(200).send(responses);
});

app.get('/mock', (req, res) => {
  if (responses.length === 0) {
    res.status(501).send('Mock API is not configured to return anything');
  } else {
    calls++;
    res.status(responses.shift()).send();
  }
});

app.get('/mock/calls', (req, res) => {
  res.status(200).send(calls.toString());
});

app.post('/mock/stop', (req, res) => {
  res.status(200).send();
  server.close();
});

server = app.listen(3000);
