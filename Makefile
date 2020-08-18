build: npm dist
	tar czvf superset.tar.gz requirements.txt dist
	
npm:
	cd superset-frontend && \
	npm install && \
	npm run build

dist:
	python3 setup.py sdist
