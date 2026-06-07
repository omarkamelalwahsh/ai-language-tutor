"""Playwright E2E smoke test for the interactive speaking-task pipeline.

This script is intentionally lightweight and headful so it can be used during
manual debugging of the task-generation path. It patches the browser's media
APIs to return a fake stream, opens the frontend, and pauses when the rendered
skill/task layout no longer matches the requested skill.
"""

import os
import sys
from pathlib import Path


def _require_playwright():
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
        return sync_playwright
    except Exception as exc:  # pragma: no cover - diagnostic helper
        print("Playwright is not installed in this environment.", file=sys.stderr)
        print("Install it with: pip install playwright && playwright install chromium", file=sys.stderr)
        raise SystemExit(1) from exc


def main() -> None:
    sync_playwright = _require_playwright()

    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    expected_skill = os.getenv("EXPECTED_SKILL", "speaking")
    target_level = os.getenv("TARGET_LEVEL", "B1")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=250)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=str(Path("backend/tests/artifacts/playwright")),
            permissions=["microphone", "camera"],
        )

        page = context.new_page()

        # Monkey-patch media capture so the page can render with a fake stream.
        page.add_init_script(
            """
            (() => {
              const makeFakeStream = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 240;
                const ctx = canvas.getContext('2d');
                if (!ctx) return null;

                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#38bdf8';
                ctx.font = '24px sans-serif';
                ctx.fillText('fake media stream', 18, 40);

                const stream = canvas.captureStream(10);
                return stream;
              };

              const fakeStream = makeFakeStream();
              if (fakeStream) {
                Object.defineProperty(navigator, 'mediaDevices', {
                  value: {
                    ...navigator.mediaDevices,
                    getUserMedia: async () => fakeStream,
                    getDisplayMedia: async () => fakeStream,
                  },
                  configurable: true,
                });
              }
            })();
            """
        )

        page.goto(base_url, wait_until="domcontentloaded")

        # The page may not expose the task card immediately; keep the script useful
        # for manual debugging while still surfacing the mismatch path.
        page.wait_for_timeout(1500)

        # Inspect the task card / skill badge text from the running frontend.
        detected_skill = page.evaluate(
            """
            () => {
              const selectors = [
                '[data-skill]',
                '[data-testid="task-skill"]',
                '.task-skill',
                '.skill-chip',
                '[class*="skill"]',
              ];
              for (const selector of selectors) {
                const node = document.querySelector(selector);
                if (node && node.textContent) {
                  return node.textContent.trim().toLowerCase();
                }
              }
              const text = document.body.innerText || '';
              const matches = text.match(/(speaking|writing|reading|listening)/i);
              return matches ? matches[1].toLowerCase() : '';
            }
            """
        )

        if detected_skill and detected_skill != expected_skill.lower():
            print(
                f"Detected skill-layout mismatch: expected '{expected_skill}' but found '{detected_skill}'",
                file=sys.stderr,
            )
            # This is the manual debugger breakpoint the interactive session needs.
            page.pause()

        # Optional: if the page exposes a CEFR badge, log it for debugging.
        page.evaluate(
            """
            () => {
              const level = document.body.innerText.match(/(A1|A2|B1|B2|C1|C2)/);
              if (level) console.log('Detected level badge:', level[1]);
            }
            """
        )

        print(f"Opened {base_url} with expected skill={expected_skill}, target_level={target_level}")
        print("Keep this window open for manual verification. Press Ctrl+C in the terminal to stop.")

        try:
            page.wait_for_timeout(60000)
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
