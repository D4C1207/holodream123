from pathlib import Path

path = Path('.github/scripts/apply_research_sync.py')
text = path.read_text()

# main.tsx was already patched directly; remove the now-redundant section so
# the one-shot migration stays idempotent.
start = text.find('# ---------- main.tsx ----------')
end = text.find('# ---------- README.md ----------')
if start >= 0 and end > start:
    text = text[:start] + text[end:]

# App.tsx moved the manual lab slightly after the original migration was written.
# Replace that fragile full-block matcher with two short, unique anchors.
block_start = text.find('# Render Bloom controls immediately before the manual lab.')
block_end = text.find('# Explain that Active metrics are probability-aware', block_start)
if block_start < 0 or block_end < 0:
    raise SystemExit('manual lab migration section not found')

replacement = r"""# Render Bloom controls immediately before the manual lab using stable short anchors.
manual_anchor = '''          <ManualDeckLab\n            data={data}\n'''
bloom_panel = '''          <RosterBloomPanel\n            data={data}\n            locale={locale}\n            ownedCardIds={[...rosterOwnedCardIdsForOptimize()]}\n            bloomByCardId={rosterBloomMapForOptimize()}\n            onChange={setRosterBloomStage}\n          />\n'''
text = replace_once(text, manual_anchor, bloom_panel + manual_anchor, "manual lab anchor")
text = replace_once(
    text,
    '            ownedCostumeIds={[...rosterOwnedCostumeIdsForOptimize()]}\n',
    '            ownedCostumeIds={[...rosterOwnedCostumeIdsForOptimize()]}\n            cardBloomById={rosterBloomMapForOptimize()}\n',
    "manual bloom prop",
)
"""
text = text[:block_start] + replacement + text[block_end:]

# The new-account initializer is a single-line call in the current App.tsx.
# Inject a precise post-patch replacement into the App migration before it writes.
app_start = text.find('# ---------- App.tsx ----------')
if app_start < 0:
    raise SystemExit('App migration section not found')
app_write = text.find('path.write_text(text)', app_start)
if app_write < 0:
    raise SystemExit('App migration write marker not found')
profile_fix = r'''text = replace_once(
    text,
    '    saveRosterInventory(profile.id, { members: [], cardsByMember: {}, costumeIds: [] });\n',
    '    saveRosterInventory(profile.id, { members: [], cardsByMember: {}, costumeIds: [], bloomByCardId: {} });\n',
    "new profile bloom",
)
'''
text = text[:app_write] + profile_fix + text[app_write:]

path.write_text(text)
print('prepared research sync script')
