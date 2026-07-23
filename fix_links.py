with open('d:/Eco/Shopping_bots/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('href="Frontend/', 'href="/Frontend/')
content = content.replace("href='Frontend/", "href='/Frontend/")

with open('d:/Eco/Shopping_bots/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated index.html to use absolute paths.')
