#!/bin/sh
# Rebuilds index.html: joins the three source files in order and embeds them in the page.
cd "$(dirname "$0")" && python3 - <<'PY'
src = ''.join(open('src/' + f, encoding='utf-8').read() for f in ['1-game.js', '2-textures.js', '3-crowd.js', '4-scene.js'])
html = open('index.html', encoding='utf-8').read()
i = html.index('<script>\n(() => {')
open('index.html', 'w', encoding='utf-8').write(html[:i] + '<script>\n' + src + '</script>\n</body>\n</html>\n')
print('index.html rebuilt')
PY
