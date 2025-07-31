from playwright.sync_api import expect
from conftest import (
    create_dataset,
    delete_dataset,
    delete_wfs_connection,
    URL,
)


def test_create_chart(page):
    create_dataset(page)

    page.goto(URL + 'chart/list/')
    page.wait_for_load_state('networkidle')

    expect(page.locator('i.fa-plus')).to_be_visible()
    page.locator('i.fa-plus').click()
    page.wait_for_load_state('networkidle')
    expect(page.get_by_text('Create a new chart')).to_be_visible()

    expect(
        page.locator(
            'input[aria-label="Dataset"]'
        )
    ).to_be_visible()
    page.locator(
            'input[aria-label="Dataset"]'
        ).click()
    page.wait_for_load_state('networkidle')
    page.locator('.ant-select-item-option-content').first.click()

    page.locator('button[name="Map"]').click()
    page.wait_for_load_state('networkidle')
    expect(page.locator("img[alt='Cartodiagram']")).to_be_visible()
    page.locator("img[alt='Cartodiagram']").click()
    expect(page.locator('h3:has-text("Cartodiagram")')).to_be_visible()
    page.get_by_text('Create new chart').click()
    page.wait_for_load_state('networkidle')
    expect(page.get_by_text('Chart source').first).to_be_visible()
    expect(page.get_by_text('Data').first).to_be_visible()
    expect(page.get_by_text('Customize').first).to_be_visible()
    expect(page.get_by_text('Configuration').first).to_be_visible()

    delete_dataset(page)
    delete_wfs_connection(page)
