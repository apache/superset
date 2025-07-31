from playwright.sync_api import expect
from conftest import URL, create_wfs_connection, delete_wfs_connection


def test_create_wfs_connection(page):
    create_wfs_connection(page)
    delete_wfs_connection(page)


def test_wfs_connection_with_invalid_url(page):
    page.goto(URL + 'databaseview/list/')
    page.wait_for_load_state('networkidle')

    expect(page.locator('i.fa-plus')).to_be_visible()
    page.locator('i.fa-plus').click()
    page.wait_for_load_state('networkidle')
    expect(page.locator('h4:has-text("Connect a database")')).to_be_visible()

    # Fill in the WFS connection form with an invalid URL
    expect(page.locator('#rc_select_4')).to_be_visible()
    page.locator('#rc_select_4').click()
    page.locator('div[title="Other"]').click()
    page.wait_for_load_state('networkidle')
    expect(page.locator('[name="sqlalchemy_uri"]')).to_be_visible()
    page.locator('[name="sqlalchemy_uri"]').fill('invalid_wfs_url')
    page.get_by_text('Test connection').click()

    # Expect an error message for invalid URL
    expect(page.get_by_text('Invalid connection string')).to_be_visible()
