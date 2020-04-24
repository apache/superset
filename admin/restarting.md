Neither gunicorn or superset provides a easy `restart` command. In order to re-start the superset server run the following


Kill all the processes associated with superset
```properties
kill $(ps aux | grep 'superset' | awk '{print $2}')
```


Start superset
```
sudo gunicorn -w 10 -k gevent \
              --timeout 120 -b 0.0.0.0:8088 \ 
              --limit-request-line 0 \
              --limit-request-field_size 0 \ 
              --statsd-host localhost:8125 superset:app

```