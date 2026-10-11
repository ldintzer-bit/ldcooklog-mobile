from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import os
os.chdir(os.path.dirname(os.path.dirname(__file__)))
server = ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler)
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--no-proxy-server','--proxy-bypass-list=*'], env={**os.environ,'HTTP_PROXY':'','HTTPS_PROXY':'','ALL_PROXY':'','http_proxy':'','https_proxy':'','all_proxy':''})
        context = browser.new_context(service_workers='allow', accept_downloads=True)
        page = context.new_page()
        page.goto(url+'/tests/smoke.html', wait_until='domcontentloaded', timeout=12000)
        page.locator('#result').filter(has_text='PASS:').wait_for(timeout=12000)
        print('STORAGE TEST:',page.locator('#result').inner_text())
        page.goto(url+'/', wait_until='domcontentloaded')
        page.locator('#status').filter(has_text='Prototype ready').wait_for(timeout=12000)
        page.locator('#food').fill('Test ribs')
        page.locator('#cooker').fill('Weber')
        page.locator('button[type=submit]').first.click()
        page.locator('#count').filter(has_text='locally stored cook').wait_for(timeout=12000)
        page.reload()
        page.locator('text=Test ribs').first.wait_for(timeout=12000)
        print('UI TEST: PASS — cook persists across reload')
        page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=12000)
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded',timeout=10000)
        page.locator('text=Test ribs').first.wait_for(timeout=12000)
        print('OFFLINE TEST: PASS — app reopens and cook is accessible without network')
        context.set_offline(False)
        browser.close()
except Exception as exc:
    print('TEST FAILED:',repr(exc))
    raise
finally:
    server.shutdown()
