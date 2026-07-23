import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Optional

import httpx
from seleniumbase import SB

executor = ThreadPoolExecutor(max_workers=3)

def _selenium_request(
    url: str,
    method: str = "GET",
    params: Optional[dict] = None,
    json_data: Optional[dict] = None,
) -> str:
    with SB(uc=True, headless=True) as sb:

        if method == "GET":
            sb.uc_open_with_disconnect(url)

            try:
                sb.uc_gui_click_captcha()
            except Exception:
                pass

            return sb.get_page_source()

        elif method == "POST":
            sb.uc_open_with_disconnect("about:blank")

            js = """
            const url = arguments[0];
            const data = arguments[1];

            return fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            })
            .then(r => r.text());
            """

            return sb.execute_script(js, url, json_data or {})

        raise ValueError("method must be GET or POST")


async def send_request(
    url: str,
    method: str = "GET",
    params: Optional[dict] = None,
    json_data: Optional[dict] = None,
) -> str:

    method = method.upper()
    header={
    "User-Agent": "Mozilla/5.0"
    }

    try:
        async with httpx.AsyncClient(timeout=15,follow_redirects=True,) as client:

            if method == "GET":
                response = await client.get(url, params=params,headers=header)

            elif method == "POST":
                response = await client.post(url, json=json_data)

            else:
                raise ValueError("method must be GET or POST")

            response.raise_for_status()

            html = response.text

            captcha_markers = (
                "g-recaptcha",
                "hcaptcha",
                "cf-challenge",
                "captcha",
            )

            if any(marker in html.lower() for marker in captcha_markers):
                raise RuntimeError("Captcha detected")

            return html

    except (
        httpx.TimeoutException,
        httpx.ConnectError,
        httpx.HTTPError,
        RuntimeError,
    ) as e:

        print(f"Falling back to Selenium: {e}")

        loop = asyncio.get_running_loop()

        return await loop.run_in_executor(
            executor,
            partial(
                _selenium_request,
                url=url,
                method=method,
                params=params,
                json_data=json_data,
            ),
        )