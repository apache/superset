cd caravel/assets/
rm build/*
npm run prod
cd ../..
python setup.py register
python setup.py sdist upload

