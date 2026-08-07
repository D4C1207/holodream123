from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text(encoding="utf-8")
old = '''function defaultRosterCardIds(member: string): string[] {
  return rosterCardsForMember(member).map((c) => c.id);
}

'''
if text.count(old) != 1:
    raise SystemExit("obsolete defaultRosterCardIds helper not found exactly once")
path.write_text(text.replace(old, "", 1), encoding="utf-8")
print("Removed obsolete defaultRosterCardIds helper.")
