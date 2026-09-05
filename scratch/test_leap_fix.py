import sqlite3, json, sys
sys.path.insert(0, '.')
from pathlib import Path
import tempfile
from app.services.compiler import compile_source_file, execute_binary
from app.services.judge import normalize_output

conn = sqlite3.connect('data/c_eval.db')
row = conn.execute('SELECT public_test_cases_json, hidden_test_cases_json FROM problems WHERE id = ?', ('week-01-p2',)).fetchone()
pub = json.loads(row[0]) if row[0] else []
hid = json.loads(row[1]) if row[1] else []
all_cases = pub + hid

test_c_code = """#include <stdio.h>
int main() {
    int N;
    if (scanf("%d", &N) != 1) return 0;
    for (int i = 0; i < N; i++) {
        int year;
        scanf("%d", &year);
        if (year > 0 && ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0))) {
            printf("Leap Year\\n");
        } else {
            printf("Not a Leap Year\\n");
        }
    }
    return 0;
}
"""

with tempfile.TemporaryDirectory() as td:
    src = Path(td) / 'sol.c'
    exe = Path(td) / 'sol.exe'
    src.write_text(test_c_code, encoding='utf-8')
    is_compiled, comp_out, _ = compile_source_file(src, exe, td)
    if not is_compiled:
        print("Compile failed:", comp_out)
        exit(1)
    
    passed = 0
    failed = []
    for idx, tc in enumerate(all_cases, 1):
        _, out, _, _, _ = execute_binary(exe, td, stdin_data=tc.get('input', ''), timeout=2.0)
        if normalize_output(out) == normalize_output(tc.get('expected_output', '')):
            passed += 1
        else:
            failed.append((idx, tc.get('input'), tc.get('expected_output'), out))
    
    print(f"Results with 'year > 0' condition: {passed} / {len(all_cases)} passed, {len(failed)} failed")
    if failed:
        for f in failed[:10]:
            print(f"  Failed #{f[0]}: in={repr(f[1])} exp={repr(f[2])} act={repr(f[3])}")
