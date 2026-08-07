from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text(encoding="utf-8")
old = "ownedRosterCostumeIds.length === 0"
new = "rosterOwnedCostumeIdsForOptimize().size === 0"
count = text.count(old)
if count != 3:
    raise SystemExit(f"Expected 3 stale roster costume checks, found {count}")
text = text.replace(old, new)
path.write_text(text, encoding="utf-8")
print(f"Replaced {count} stale FAB costume checks.")
