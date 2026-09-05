import zipfile
from app.database.db import get_week_problems
from app.services.pack_generator import seed_default_pack_for_week

problems = get_week_problems("week-01")
if not problems:
    problems = seed_default_pack_for_week("week-01", 1)

with zipfile.ZipFile("data/test_week2_submissions.zip", "w") as z:
    for p in problems:
        z.writestr(f"23001/p{p.number}.c", p.reference_solution_c)
    z.writestr("23002/p1.c", '#include <stdio.h>\nint main() {\n    printf("Syntax Error")\n    return 0;\n}')
    z.writestr("23002/p2.c", '#include <stdio.h>\nint main() {\n    printf("WRONG\\n");\n    return 0;\n}')
    z.writestr("23003/p1.c", problems[0].reference_solution_c)

print("Created data/test_week2_submissions.zip successfully")
