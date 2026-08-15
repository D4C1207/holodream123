from pathlib import Path

path = Path('.github/scripts/apply_active_special_scoring.py')
text = path.read_text()
old = '''text = replace_once(\n    text,\n    '  buffGain: number;\\n};\\n',\n    '  buffGain: number;\\n  specialSynergy: number;\\n};\\n',\n    "decision metrics type",\n)\ntext = replace_once(\n    text,\n    '  buffGain: number;\\n};\\n\\nexport function teamDecisionKey',\n    '  buffGain: number;\\n  specialSynergy: number;\\n};\\n\\nexport function teamDecisionKey',\n    "decision diff type",\n)\n'''
new = '''text = replace_once(\n    text,\n    '  costumeSatisfied: boolean;\\n  buffGain: number;\\n};\\n\\nexport type TeamMetricDiff',\n    '  costumeSatisfied: boolean;\\n  buffGain: number;\\n  specialSynergy: number;\\n};\\n\\nexport type TeamMetricDiff',\n    "decision metrics type",\n)\ntext = replace_once(\n    text,\n    '  passiveSatisfied: number;\\n  buffGain: number;\\n};\\n\\nexport function teamDecisionKey',\n    '  passiveSatisfied: number;\\n  buffGain: number;\\n  specialSynergy: number;\\n};\\n\\nexport function teamDecisionKey',\n    "decision diff type",\n)\n'''
if text.count(old) != 1:
    raise SystemExit(f'expected migration matcher block once, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Fixed teamDecision matcher in Active/Special migration.')
