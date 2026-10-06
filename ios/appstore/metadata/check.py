# Usage: python3 ios/appstore/metadata/check.py  — validates every <locale>.json here.
import json, os, sys
d = os.path.dirname(os.path.abspath(__file__)); bad = 0
for f in sorted(os.listdir(d)):
    if not f.endswith(".json"): continue
    try: j = json.load(open(os.path.join(d, f), encoding="utf-8"))
    except Exception as e: print(f, "INVALID JSON", e); bad += 1; continue
    p = []
    desc, kw = j.get("description", ""), j.get("keywords", "")
    if set(j) != {"description", "keywords"}: p.append("keys must be exactly description, keywords")
    if not desc.strip() or len(desc) > 4000: p.append("description empty or over 4000 chars")
    if "Flickgame" not in desc: p.append("description must contain the name Flickgame")
    if desc.count("•") != 6: p.append("description must keep the 6 bullet lines starting with •")
    if not kw or len(kw) > 100: p.append("keywords empty or over 100 characters (%d)" % len(kw))
    if ", " in kw or "，" in kw or "、" in kw: p.append("keywords: use plain commas with no spaces")
    if "flickgame" in kw.lower(): p.append("keywords must not contain the app name")
    if p: bad += 1; print(f, p)
print("%d file(s) with problems" % bad if bad else "all files ok"); sys.exit(1 if bad else 0)
