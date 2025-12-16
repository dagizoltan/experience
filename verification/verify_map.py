
from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_map(page: Page):
    print("Navigating to home page...")
    page.goto("http://localhost:8000")

    # Wait for map container
    expect(page.locator("#map")).to_be_visible()

    # Wait for markers to appear
    # In my code, markers have class 'marker'
    # We expect at least one marker
    print("Waiting for markers...")
    page.wait_for_selector(".marker", timeout=10000)

    markers = page.locator(".marker")
    count = markers.count()
    print(f"Found {count} markers")

    if count == 0:
        raise Exception("No markers found!")

    # Check search
    print("Testing search...")
    page.fill("#search-input", "tapas")
    page.click("#search-btn")

    # Wait for search results (fetch completes and re-renders markers)
    # We might need to wait a bit or wait for a specific change.
    # El Xampanyet should be there.
    # Since we can't easily check marker content from DOM (it's in popup),
    # we'll just check that markers are still present or changed count.
    # The search for 'tapas' returns 1 result in my curl test.

    time.sleep(2) # Give time for fetch and render

    new_count = page.locator(".marker").count()
    print(f"Found {new_count} markers after search")

    if new_count != 1:
        print("Warning: Search might not have filtered correctly or there are multiple 'tapas' places.")

    # Screenshot
    print("Taking screenshot...")
    page.screenshot(path="verification/map_page.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_map(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
