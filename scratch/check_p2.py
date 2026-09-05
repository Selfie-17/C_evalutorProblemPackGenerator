import sqlite3
import json
import subprocess
import tempfile
import os

conn = sqlite3.connect('data/c_eval.db')
row = conn.execute('SELECT id, title, description, input_format, output_format, public_test_cases_json, hidden_test_cases_json, reference_solution_c FROM problems WHERE id = ?', ('week-01-p2',)).fetchone()

if not row:
    print("Problem week-01-p2 not found")
    exit(1)

pid, title, desc, inp_fmt, out_fmt, pub_json, hid_json, ref_c = row
pub = json.loads(pub_json) if pub_json else []
hid = json.loads(hid_json) if hid_json else []
all_cases = pub + hid

print(f"Problem: {pid} - {title}")
print(f"Input format: {inp_fmt}")
print(f"Output format: {out_fmt}")
print(f"Total test cases: {len(all_cases)} (Public: {len(pub)}, Hidden: {len(hid)})")
print("\n--- Reference Solution ---")
print(ref_c)

import sys
sys.path.insert(0, '.')
from pathlib import Path
import tempfile

from app.services.compiler import compile_source_file, execute_binary
from app.services.judge import normalize_output

with tempfile.TemporaryDirectory(prefix="p2_test_") as temp_dir:
    src_file = Path(temp_dir) / "sol.c"
    exe_file = Path(temp_dir) / "sol.exe"
    src_file.write_text(ref_c, encoding="utf-8")
    
    is_compiled, comp_out, exit_code = compile_source_file(src_file, exe_file, temp_dir)
    if not is_compiled:
        print("Compilation FAILED:", comp_out)
        exit(1)

    print("Compilation SUCCESS!")

    failed_cases = []
    for i, tc in enumerate(all_cases):
        inp = tc.get("input", "")
        exp = tc.get("expected_output", "")
        tid = tc.get("id") or tc.get("test_id") or f"Case-{i+1}"
        cat = tc.get("category", "")
        
        ret_code, stdout, stderr, elapsed_ms, is_timeout = execute_binary(exe_file, temp_dir, stdin_data=inp, timeout=2.0)
        
        passed = normalize_output(stdout) == normalize_output(exp)
        if not passed:
            failed_cases.append({
                "index": i + 1,
                "id": tid,
                "category": cat,
                "input": repr(inp),
                "expected": repr(exp),
                "actual": repr(stdout),
                "stderr": repr(stderr),
                "timed_out": is_timeout
            })


print(f"Results: {len(all_cases) - len(failed_cases)} / {len(all_cases)} passed, {len(failed_cases)} failed.")
if failed_cases:
    print(f"\nFailed cases count: {len(failed_cases)}")
    for fc in failed_cases:
        print(f"  [#{fc['index']} - {fc['id']} ({fc['category']})]")
        print(f"    Input:    {fc['input']}")
        print(f"    Expected: {fc['expected']}")
        print(f"    Actual:   {fc['actual']}")
        if fc['timed_out']:
            print(f"    Timed out: True")
        if fc['stderr'] and fc['stderr'] != "''":
            print(f"    Stderr:   {fc['stderr']}")

