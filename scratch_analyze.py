import glob
from bs4 import BeautifulSoup
import os

for file in glob.glob('d:/Eco/Shopping_bots/Frontend/src/pages/*.html'):
    with open(file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    for a in soup.find_all('a'):
        text = a.text.strip().lower()
        if not text:
            print(f'{os.path.basename(file)}: empty text anchor -> {a.get("href", "")}')
    
    for element in soup.find_all(string=lambda text: text and 'PRC Engine' in text):
        parent = element.parent
        print(f'{os.path.basename(file)}: PRC Engine text in <{parent.name}>')
