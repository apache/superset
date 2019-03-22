set -e
EXECUTE_TEST=$1
echo -e "# # # # # # # STARTING : Unit Test Exceution # # # # # # #"
pip install tox
tox -e ${EXECUTE_TEST}
echo -e "# # # # # # # COMPLETED : Unit Test Exceution # # # # # # #"