from pathlib import Path
import json,re,sys,subprocess
root=Path(__file__).resolve().parents[1]
SKIP={'.git','node_modules','.wrangler','.git-hooks','__pycache__'}
issues=[]; count=0
for path in root.rglob('*'):
 if any(p in SKIP for p in path.relative_to(root).parts) or not path.is_file():continue
 rel=path.relative_to(root).as_posix(); count+=1
 if path.stat().st_size>1024*1024: issues.append((rel,'file exceeds 1 MiB'))
 if path.suffix.lower() in {'.dpapi','.log','.bin','.lua','.pyc','.sqlite','.db'} or (path.name.startswith(('.env','.dev.vars')) and not path.name.endswith('.example')):issues.append((rel,'private/generated file'))
 if path.suffix=='.png':continue
 try:text=path.read_text(encoding='utf-8-sig')
 except UnicodeDecodeError:issues.append((rel,'invalid UTF-8'));continue
 patterns=[r'AIza[0-9A-Za-z_-]{35}',r'gh[pousr]_[A-Za-z0-9]{20,}',r'github_pat_[A-Za-z0-9_]{20,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'\b[A-Za-z0-9._%+-]+@(?:gmail|hotmail|outlook)\.com\b']
 if any(re.search(p,text) for p in patterns):issues.append((rel,'potential secret or private contact'))
 if path.suffix=='.json':
  try:json.loads(text)
  except ValueError:issues.append((rel,'invalid JSON'))
try:
 files=subprocess.run(['git','ls-files'],cwd=root,capture_output=True,text=True,check=True).stdout.splitlines()
 if any(any(part in SKIP for part in Path(f).parts) for f in files):issues.append(('git index','generated directory tracked'))
except (OSError,subprocess.CalledProcessError):pass
for rel,reason in issues:print(f'FAIL {rel}: {reason}')
print(f'Public-file scan: {count} files; {len(issues)} findings. Values are never printed.')
sys.exit(bool(issues))
