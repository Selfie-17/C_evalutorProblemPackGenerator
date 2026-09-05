import sqlite3
import json
import sys
from pathlib import Path
import tempfile

sys.path.insert(0, '.')
from app.services.compiler import compile_source_file, execute_binary
from app.services.judge import normalize_output

conn = sqlite3.connect('data/c_eval.db')
rows = conn.execute('SELECT id, title, public_test_cases_json, hidden_test_cases_json, reference_solution_c FROM problems').fetchall()

for row in rows:
    pid, title, pub_j, hid_j, ref_c = row
    pub = json.loads(pub_j) if pub_j else []
    hid = json.loads(hid_j) if hid_j else []
    all_cases = pub + hid
    print(f"\n==================================================")
    print(f"Problem {pid}: '{title}' ({len(all_cases)} total test cases)")
    
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "s.c"
        exe = Path(td) / "s.exe"
        src.write_text(ref_c, encoding='utf-8')
        comp, out, _ = compile_source_file(src, exe, td)
        if not comp:
            print(f"  [ERROR] Reference solution compilation failed: {out}")
            continue
            
        passed = 0
        failed = []
        for idx, tc in enumerate(all_cases, 1):
            inp = tc.get("input", "")
            exp = tc.get("expected_output", "")
            _, stdout, stderr, ms, timeout = execute_binary(exe, td, stdin_data=inp, timeout=2.0)
            if normalize_output(stdout) == normalize_output(exp):
                passed += 1
            else:
                failed.append({
                    "num": idx,
                    "id": tc.get("id") or tc.get("test_id") or f"Case-{idx}",
                    "in": inp,
                    "exp": exp,
                    "act": stdout,
                })
        print(f"  Passed: {passed} / {len(all_cases)} ({passed/len(all_cases)*100:.1f}%) | Failed: {len(failed)}")
        if failed:
            print(f"  Sample failures ({min(5, len(failed))} of {len(failed)}):")
            for f in failed[:5]:
                print(f"    - Case #{f['num']} ({f['id']}):")
                print(f"        stdin:    {repr(f['in'])}")
                print(f"        expected: {repr(f['exp'])}")
                print(f"        actual:   {repr(f['act'])}")
