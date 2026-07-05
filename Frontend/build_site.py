import os
import re

BASE = r'C:\Users\HP\.gemini\antigravity-ide\brain\e2d38744-93a6-4784-9366-3d0b3da9dbbe\.system_generated\steps'

files = {
    'index': os.path.join(BASE, '13', 'content.md'),
    'signup': os.path.join(BASE, '14', 'content.md'),
    'login': os.path.join(BASE, '15', 'content.md'),
}

out_dir = r'D:\Eco\Shopping_bots\Frontend\prc-engine'
os.makedirs(out_dir, exist_ok=True)

def extract_html(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    idx = content.find('<!DOCTYPE html>')
    return content[idx:] if idx != -1 else content

# ---- index.html (Price Tracker Dashboard) ----
content = extract_html(files['index'])
content = content.replace(
    '<button class="hover:opacity-80 transition-opacity">\n<span class="material-symbols-outlined text-primary">account_circle</span>\n</button>',
    '<a href="login.html" class="hover:opacity-80 transition-opacity">\n<span class="material-symbols-outlined text-primary">account_circle</span>\n</a>'
)
with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(content)
print('index.html written')

# ---- signup.html ----
content = extract_html(files['signup'])
content = content.replace(
    'href="#">\n                        Log In to PRC Engine',
    'href="login.html">\n                        Log In to PRC Engine'
)
content = content.replace(
    'onsubmit="event.preventDefault();"',
    'onsubmit="handleSignup(event);"'
)
signup_js = """
<script>
function handleSignup(e) {
    e.preventDefault();
    var name = document.getElementById('fullname').value;
    var email = document.getElementById('email').value;
    if (name && email) {
        localStorage.setItem('prc_user', JSON.stringify({name: name, email: email}));
        window.location.href = 'index.html';
    }
}
</script>
"""
content = content.replace('</body>', signup_js + '</body>')
with open(os.path.join(out_dir, 'signup.html'), 'w', encoding='utf-8') as f:
    f.write(content)
print('signup.html written')

# ---- login.html ----
content = extract_html(files['login'])
content = content.replace(
    'href="#">Request Onboarding</a>',
    'href="signup.html">Request Onboarding</a>'
)
content = content.replace(
    'onsubmit="event.preventDefault();"',
    'onsubmit="handleLogin(event);"'
)
login_js = """
<script>
function handleLogin(e) {
    e.preventDefault();
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    if (email && password) {
        localStorage.setItem('prc_user', JSON.stringify({email: email}));
        window.location.href = 'index.html';
    }
}
</script>
"""
content = content.replace('</body>', login_js + '</body>')
with open(os.path.join(out_dir, 'login.html'), 'w', encoding='utf-8') as f:
    f.write(content)
print('login.html written')

print()
print('All files saved to:', out_dir)
print('Files:', os.listdir(out_dir))
