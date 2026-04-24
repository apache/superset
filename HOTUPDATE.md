# How to enable hot update with Apache Superset

1. Clone the Superset repo
```
git clone https://github.com/apache/superset.git
```

2. Install dependenices on the local frontend
```
cd superset-frontend
npm install
```

3. Start the local frontend
```
cd superset-frontend
npm run dev-server
```

4. Update `docker-compose.override.yml` to point to local frontend
```
version: "3"
services:
  superset:
    volumes:
      - ./superset-frontend:/app/superset-frontend
```

5. Start Docker instance
```
docker compose -f docker-compose-light.yml up
```