from playwright.sync_api import sync_playwright
import json

def verify_map():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Ensure viewport is large enough
        page = browser.new_page(viewport={'width': 1200, 'height': 800})

        print("Navigating to http://localhost:8000...")
        page.goto("http://localhost:8000")

        # Wait for map load
        page.wait_for_timeout(3000)

        # Extract initial state
        initial_state = page.evaluate("window.__INITIAL_STATE__")
        print("Initial State View:", json.dumps(initial_state['view'], indent=2))
        print("Initial State Places Count:", len(initial_state['places']['features']))

        # Take screenshot
        output_path = "verification/map_catalonia.png"
        page.screenshot(path=output_path)
        print(f"Screenshot saved to {output_path}")

        browser.close()

if __name__ == "__main__":
    verify_map()
