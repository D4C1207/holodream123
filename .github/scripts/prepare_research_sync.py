from pathlib import Path

path = Path('.github/scripts/apply_research_sync.py')
text = path.read_text()
start = text.find('# ---------- main.tsx ----------')
end = text.find('# ---------- README.md ----------')
if start >= 0 and end > start:
    text = text[:start] + text[end:]
path.write_text(text)
print('prepared research sync script')
