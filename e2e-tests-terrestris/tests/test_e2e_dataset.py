from conftest import (
    create_dataset,
    delete_dataset,
    delete_wfs_connection,
)


def test_create_dataset(page):
    create_dataset(page)
    delete_dataset(page)
    delete_wfs_connection(page)
