from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str, min_count: int = 1) -> str:
    count = text.count(old)
    if count < min_count:
        raise SystemExit(f"{label}: expected at least {min_count} match(es), got {count}")
    return text.replace(old, new)


app_path = Path("src/App.tsx")
app = app_path.read_text(encoding="utf-8")

replacements = [
    ('<strong>D4C</strong>', '<strong>SC</strong>', 'favorite metric'),
    (' · D4C ${lastRosterScores[activeRosterProfileId].d4cIndex.toLocaleString()}', ' · SC ${lastRosterScores[activeRosterProfileId].d4cIndex.toLocaleString()}', 'dashboard score'),
    ('<p><strong>D4C：</strong>', '<p><strong>SC：</strong>', 'rule guide label'),
    ('PRではなくD4C実戦指数で前後比較します。', 'PRではなくSCで前後比較します。', 'ja simulator help'),
    ('the fixed D4C Battle Index rather than PR.', 'SC rather than PR.', 'en simulator help'),
    ('固定公式的 D4C 實戰指數比較，不拿 PR 硬比。', '固定公式的 SC 比較，不拿 PR 硬比。', 'zh simulator help'),
    ('<div className="simulator-metric"><span>D4C</span>', '<div className="simulator-metric"><span>SC</span>', 'simulator metric'),
    ('<tr><td>D4C</td>', '<tr><td>SC</td>', 'comparison metric'),
    ('<span className="label">D4C · {locale === "ja" ? "実戦指数" : locale === "en" ? "Battle Index" : "實戰指數"}</span>', '<span className="label">SC</span>', 'detail score label'),
]

for old, new, label in replacements:
    app = replace_required(app, old, new, label)

app_path.write_text(app, encoding="utf-8")

readme_path = Path("README.md")
readme = readme_path.read_text(encoding="utf-8")
readme = readme.replace("D4C 實戰指數", "SC")
readme = readme.replace("D4C 指數", "SC")
readme = readme.replace("D4C Battle Index", "SC")
readme_path.write_text(readme, encoding="utf-8")

decision_path = Path("src/lib/teamDecision.ts")
decision = decision_path.read_text(encoding="utf-8")
decision = decision.replace("D4C 實戰指數（非官方估算）", "SC（非官方估算）")
decision_path.write_text(decision, encoding="utf-8")

print("Renamed user-facing D4C index labels to SC while preserving storage/internal keys.")
