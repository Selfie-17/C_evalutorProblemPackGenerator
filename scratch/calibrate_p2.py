import sqlite3
import json
import sys
from pathlib import Path
import tempfile

sys.path.insert(0, '.')
from app.services.compiler import compile_source_file, execute_binary
from app.services.judge import normalize_output

conn = sqlite3.connect('data/c_eval.db')
row = conn.execute('SELECT id, title, public_test_cases_json, hidden_test_cases_json, reference_solution_c FROM problems WHERE id = ?', ('week-01-p2',)).fetchone()

if not row:
    print("Problem not found")
    sys.exit(1)

pid, title, pub_j, hid_j, ref_c = row
pub = json.loads(pub_j) if pub_j else []
hid = json.loads(hid_j) if hid_j else []

print(f"Problem: {title}")
print(f"Initial: {len(pub)} public, {len(hid)} hidden test cases")

# Standard Leap Year reference solution
# A year is a leap year if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
ref_code = """#include <stdio.h>

int main() {
    int N;
    if (scanf("%d", &N) != 1) return 0;
    for (int i = 0; i < N; i++) {
        int year;
        if (scanf("%d", &year) != 1) break;
        if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {
            printf("Leap Year\\n");
        } else {
            printf("Not a Leap Year\\n");
        }
    }
    return 0;
}
"""

with tempfile.TemporaryDirectory(prefix="calib_") as td:
    src = Path(td) / "sol.c"
    exe = Path(td) / "sol.exe"
    src.write_text(ref_code, encoding="utf-8")
    comp, out, _ = compile_source_file(src, exe, td)
    if not comp:
        print("Compile failed:", out)
        sys.exit(1)
        
    def calibrate_cases(cases, prefix):
        calibrated = []
        # Curate valid positive years to replace negative ones
        # Rich edge cases: century years, leap centuries, normal leap years, non-leap years, boundaries
        positive_edge_pool = [
            4, 8, 12, 16, 20, 24, 28, 32, 40, 96,
            100, 200, 300, 500, 600, 700, 900, 1000, 1100, 1300, 1400, 1500, 1700, 1800, 1900, 2100, 2200, 2300, 2500,
            400, 800, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000,
            1996, 1997, 1998, 1999, 2001, 2002, 2003, 2004, 2005, 2008, 2012, 2016, 2020, 2024, 2025, 2026, 2027, 2028,
            1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
            10000, 10004, 10100, 10400, 99996, 99999, 100000, 100004, 400000
        ]
        pool_idx = 0

        for i, tc in enumerate(cases):
            raw_in = tc.get("input", "").strip()
            lines = raw_in.split()
            # If input has negative year or 0, replace with a positive year from edge pool
            has_invalid_year = False
            new_lines = []
            if len(lines) >= 2:
                n_str = lines[0]
                new_lines.append(n_str)
                for y_str in lines[1:]:
                    try:
                        y_val = int(y_str)
                        if y_val <= 0:
                            has_invalid_year = True
                            replacement_year = positive_edge_pool[pool_idx % len(positive_edge_pool)]
                            pool_idx += 1
                            new_lines.append(str(replacement_year))
                        else:
                            new_lines.append(y_str)
                    except ValueError:
                        new_lines.append(y_str)
            elif len(lines) == 1:
                try:
                    y_val = int(lines[0])
                    if y_val <= 0:
                        has_invalid_year = True
                        new_lines.append(str(positive_edge_pool[pool_idx % len(positive_edge_pool)]))
                        pool_idx += 1
                    else:
                        new_lines.append(lines[0])
                except ValueError:
                    new_lines.append(lines[0])
            else:
                new_lines = ["1", "2024"]

            new_input = "\n".join(new_lines) + "\n"
            
            # Execute with reference binary to get authoritative ground truth
            _, stdout, stderr, ms, timeout = execute_binary(exe, td, stdin_data=new_input, timeout=2.0)
            
            calibrated.append({
                "id": tc.get("id") or tc.get("test_id") or f"{prefix}-{i+1:02d}",
                "test_id": tc.get("id") or tc.get("test_id") or f"{prefix}-{i+1:02d}",
                "category": tc.get("category", "edge" if has_invalid_year else "base"),
                "input": new_input,
                "expected_output": stdout,
                "reason": tc.get("reason", "Leap year test case"),
                "severity": tc.get("severity", "normal"),
                "validation_status": "passed",
                "validation_notes": "Calibrated with C reference solution",
            })
        return calibrated

    new_pub = calibrate_cases(pub, "P2-Pub")
    new_hid = calibrate_cases(hid, "P2-Hid")

    print(f"Calibrated: {len(new_pub)} public, {len(new_hid)} hidden test cases")

    # Update database
    conn.execute(
        "UPDATE problems SET public_test_cases_json = ?, hidden_test_cases_json = ?, reference_solution_c = ?, is_verified = 1 WHERE id = ?",
        (json.dumps(new_pub), json.dumps(new_hid), ref_code, pid)
    )
    conn.commit()
    print("Database updated successfully!")
