# first bump up package.json manually, commit and tag
rm superset/assets/dist/*
cd superset/assets/
rm build/*
npm run prod
cd ../..
python setup.py sdist upload

