import glob
import os

files = glob.glob('d:/Eco/Shopping_bots/Frontend/src/pages/*.html')

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace JS redirects
    content = content.replace("window.location.href = 'login.html'", "window.location.href = '/Frontend/src/pages/login.html'")
    content = content.replace("window.location.href = 'dashboard.html'", "window.location.href = '/Frontend/src/pages/dashboard.html'")
    
    # Replace default redirect fallback in login.html
    content = content.replace("|| 'dashboard.html'", "|| '/Frontend/src/pages/dashboard.html'")
    
    # Also replace any href='...' or href="..." in the HTML to absolute if they are just the filename
    # Actually, it's safer to leave them if they work, but let's replace the common ones in the navigation
    content = content.replace('href="dashboard.html"', 'href="/Frontend/src/pages/dashboard.html"')
    content = content.replace('href="price-tracking.html"', 'href="/Frontend/src/pages/price-tracking.html"')
    content = content.replace('href="profile.html"', 'href="/Frontend/src/pages/profile.html"')
    content = content.replace('href="login.html"', 'href="/Frontend/src/pages/login.html"')
    content = content.replace('href="signup.html"', 'href="/Frontend/src/pages/signup.html"')
    content = content.replace('href="product-list.html"', 'href="/Frontend/src/pages/product-list.html"')
    
    # Also fix the logo linking to index.html
    content = content.replace('href="../../../index.html"', 'href="/"')

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print('Updated internal pages to use absolute paths.')
