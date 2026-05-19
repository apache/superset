import asyncio
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

async def click_first(locator_candidates, timeout=5000) -> None:
    last_error = None
    for locator in locator_candidates:
        try:
            await locator.first.click(timeout=timeout)
            return
        except PlaywrightTimeoutError as exc:
            last_error = exc
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    if last_error:
        raise last_error

async def wait_for_any(locator_candidates, timeout=5000) -> None:
    last_error = None
    for locator in locator_candidates:
        try:
            await locator.first.wait_for(state="visible", timeout=timeout)
            return
        except PlaywrightTimeoutError as exc:
            last_error = exc
    if last_error:
        raise last_error

async def run():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("https://finops.sondahybrid.com/login/")
        await page.get_by_role("textbox", name="Nome de usuário:").click()
        await page.get_by_role("textbox", name="Nome de usuário:").fill("afarias")
        await page.get_by_role("textbox", name="Senha:").fill("Sondabrasil@123")
        await page.get_by_role("button", name="Entrar").click()
        await page.wait_for_load_state("networkidle")

        await page.goto("https://finops.sondahybrid.com/superset/dashboard/12/")
        await page.wait_for_load_state("networkidle")

        await click_first(
            [
                page.get_by_role("button", name="Salvar"),
                page.get_by_role("button", name="Mais"),
                page.get_by_role("button", name="Ações"),
                page.locator('button[aria-label*="Mais"]'),
                page.locator('button[aria-label*="More"]'),
                page.locator('button[aria-label*="Ações"]'),
                page.locator('button[aria-haspopup="menu"]'),
            ],
            timeout=10000,
        )

        await wait_for_any(
            [
                page.get_by_role("menu"),
                page.get_by_role("menuitem", name="Salvar como"),
                page.get_by_role("menuitem", name="Save as"),
                page.locator('.ant-dropdown-menu'),
            ],
            timeout=10000,
        )

        await click_first(
            [
                page.get_by_role("menuitem", name="Salvar como", exact=True),
                page.get_by_role("menuitem", name="Save as", exact=True),
                page.locator('a:has-text("Salvar como")'),
                page.locator('div:has-text("Salvar como")'),
                page.locator('span:has-text("Salvar como")'),
                page.locator('li:has-text("Salvar como")'),
            ],
            timeout=15000,
        )

        dialog = page.get_by_role("dialog")
        await dialog.get_by_role("textbox").click()
        await dialog.get_by_role("textbox").fill("SONDA-CS-TESTE")
        await click_first(
            [
                dialog.get_by_role("button", name="Salvar"),
                dialog.locator('span:has-text("Salvar")'),
            ],
        )
        await browser.close()

asyncio.run(run())
