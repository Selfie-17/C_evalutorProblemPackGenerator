"""
Raw Problem Text Parser.
Extracts individual problems from arbitrary teacher text inputs (e.g. 1., P1:, Problem 1:, 1))
while strictly preserving original statements.
"""

import re
from typing import List, Tuple
from problem_engine.problem_schema import Problem


# Matches standard problem header prefixes at start of line:
# 1. / 1) / P1: / P1. / P1 - / Problem 1: / Problem 1. / Problem 1 - / Q1:
PROBLEM_HEADER_PATTERN = re.compile(
    r"^(?:(?:Problem\s*|P|Q)?(\d+)[\.\)]|(?:Problem\s*|P|Q)(\d+)[\:\.\-]?)\s*(.*)$",
    re.IGNORECASE,
)


def _derive_preliminary_title(statement: str, index: int) -> str:
    """
    Derive a clean, concise human title from the statement without altering the statement.
    E.g. "Write a C program to check whether a given number is even or odd." -> "Even or Odd"
    """
    clean = statement.strip()
    # Strip common boilerplate lead-ins
    clean = re.sub(
        r"^(?:write\s+a\s+c\s+program\s+(?:to|that)|write\s+a\s+program\s+(?:to|that)|program\s+to|check\s+whether|determine\s+whether|find)\s+",
        "",
        clean,
        flags=re.IGNORECASE,
    )
    # Take first sentence or up to 60 chars
    first_sentence = re.split(r"[\.\n;]", clean)[0].strip()
    if first_sentence:
        # Capitalize words
        words = first_sentence.split()[:7]
        title = " ".join(words)
        return title[:50].strip().title()
    return f"Problem {index}"


def parse_raw_problems(raw_text: str) -> List[Problem]:
    """
    Parse multiline raw text into a list of Problem objects.
    Preserves exact problem statement in both statement and original_statement.
    """
    if not raw_text or not raw_text.strip():
        return []

    lines = raw_text.strip().splitlines()
    raw_blocks: List[Tuple[int, List[str]]] = []
    current_number: int = 0
    current_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_lines:
                current_lines.append("")
            continue

        match = PROBLEM_HEADER_PATTERN.match(stripped)
        if match:
            # We encountered a new problem header
            if current_lines:
                raw_blocks.append((current_number, current_lines))
                current_lines = []

            num_str = match.group(1) or match.group(2)
            current_number = int(num_str) if num_str else (len(raw_blocks) + 1)
            first_line_content = match.group(3).strip()
            current_lines = [first_line_content] if first_line_content else []
        else:
            if current_lines:
                current_lines.append(line)
            else:
                # Text before any problem delimiter
                current_number = len(raw_blocks) + 1
                current_lines = [line]

    if current_lines:
        raw_blocks.append((current_number, current_lines))

    # If no headers matched at all, treat each non-empty line or block as a problem
    if not raw_blocks:
        non_empty = [l.strip() for l in lines if l.strip()]
        raw_blocks = [(i + 1, [line]) for i, line in enumerate(non_empty)]

    problems: List[Problem] = []
    for idx, (orig_num, text_lines) in enumerate(raw_blocks, start=1):
        statement = "\n".join(text_lines).strip()
        if not statement:
            continue

        p_id = f"P{idx}"
        title = _derive_preliminary_title(statement, idx)

        problem = Problem(
            problem_id=p_id,
            title=title,
            statement=statement,
            original_statement=statement,
            requirements=[],
            concepts=[],
            constraints=[],
            division_approved=False,
        )
        problems.append(problem)

    return problems
