import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from app.config import PROBLEMS_FILE

logger = logging.getLogger(__name__)


@dataclass
class TestCase:
    input: str
    expected_output: str
    is_hidden: bool = False


@dataclass
class Problem:
    id: str
    title: str
    description: str
    time_limit: float = 2.0  # seconds
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: List[str] = field(default_factory=list)
    difficulty: str = "Easy"
    topics: List[str] = field(default_factory=list)
    hints: List[str] = field(default_factory=list)
    sample_cases: List[TestCase] = field(default_factory=list)
    hidden_cases: List[TestCase] = field(default_factory=list)

    @property
    def all_test_cases(self) -> List[TestCase]:
        return self.sample_cases + self.hidden_cases

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Problem":
        sample_cases = [TestCase(**tc) for tc in data.get("sample_cases", [])]
        hidden_cases = [TestCase(**tc) for tc in data.get("hidden_cases", [])]
        return cls(
            id=data["id"],
            title=data["title"],
            description=data["description"],
            time_limit=data.get("time_limit", 2.0),
            input_format=data.get("input_format"),
            output_format=data.get("output_format"),
            constraints=data.get("constraints", []),
            difficulty=data.get("difficulty", "Easy"),
            topics=data.get("topics", []),
            hints=data.get("hints", []),
            sample_cases=sample_cases,
            hidden_cases=hidden_cases,
        )


# Built-in default seed problems
SEED_PROBLEMS: Dict[str, Problem] = {
    "sum-two-numbers": Problem(
        id="sum-two-numbers",
        title="Sum of Two Numbers",
        description=(
            "Given two space-separated integers a and b from standard input, "
            "compute and print their sum to standard output."
        ),
        time_limit=2.0,
        difficulty="Easy",
        topics=["Math", "Implementation"],
        input_format="Two space-separated integers a and b.",
        output_format="Print a single integer: the sum of a and b.",
        constraints=["-10^9 <= a, b <= 10^9"],
        sample_cases=[
            TestCase(input="10 20", expected_output="30", is_hidden=False),
            TestCase(input="5 7", expected_output="12", is_hidden=False),
        ],
        hidden_cases=[
            TestCase(input="-10 15", expected_output="5", is_hidden=True),
            TestCase(input="0 0", expected_output="0", is_hidden=True),
            TestCase(input="1000 -500", expected_output="500", is_hidden=True),
        ],
    ),
    "is-palindrome": Problem(
        id="is-palindrome",
        title="Palindrome Number",
        description=(
            "Given an integer x from standard input, print 1 if x is a palindrome integer, "
            "otherwise print 0. Negative numbers are not palindromes."
        ),
        time_limit=2.0,
        difficulty="Easy",
        topics=["Math"],
        input_format="A single integer x.",
        output_format="Print 1 if x is palindrome, else 0.",
        constraints=["-2^31 <= x <= 2^31 - 1"],
        sample_cases=[
            TestCase(input="121", expected_output="1", is_hidden=False),
            TestCase(input="-121", expected_output="0", is_hidden=False),
            TestCase(input="10", expected_output="0", is_hidden=False),
        ],
        hidden_cases=[
            TestCase(input="12321", expected_output="1", is_hidden=True),
            TestCase(input="0", expected_output="1", is_hidden=True),
            TestCase(input="123456", expected_output="0", is_hidden=True),
        ],
    ),
    "factorial": Problem(
        id="factorial",
        title="Factorial of a Number",
        description=(
            "Given a non-negative integer n (0 <= n <= 15) from standard input, "
            "calculate and print n! (n factorial)."
        ),
        time_limit=2.0,
        difficulty="Easy",
        topics=["Math", "Recursion"],
        input_format="A single non-negative integer n.",
        output_format="Print n! as an integer.",
        constraints=["0 <= n <= 15"],
        sample_cases=[
            TestCase(input="5", expected_output="120", is_hidden=False),
            TestCase(input="0", expected_output="1", is_hidden=False),
        ],
        hidden_cases=[
            TestCase(input="1", expected_output="1", is_hidden=True),
            TestCase(input="6", expected_output="720", is_hidden=True),
            TestCase(input="10", expected_output="3628800", is_hidden=True),
        ],
    ),
}

# Active in-memory problem store
PROBLEMS: Dict[str, Problem] = {**SEED_PROBLEMS}


def save_problems_to_disk() -> None:
    """Persist all registered problems to data/problems.json."""
    try:
        data = {k: v.to_dict() for k, v in PROBLEMS.items()}
        PROBLEMS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception as e:
        logger.error(f"Failed to persist problems to {PROBLEMS_FILE}: {e}")


def load_problems_from_disk() -> None:
    """Load previously generated and persisted problems from disk into memory."""
    global PROBLEMS
    if not PROBLEMS_FILE.is_file():
        # First time init: save seeds to disk
        save_problems_to_disk()
        return

    try:
        content = PROBLEMS_FILE.read_text(encoding="utf-8")
        if not content.strip():
            return
        data = json.loads(content)
        for problem_id, p_data in data.items():
            PROBLEMS[problem_id] = Problem.from_dict(p_data)
    except Exception as e:
        logger.error(f"Failed to load problems from {PROBLEMS_FILE}: {e}")


def register_problem(problem: Problem, persist: bool = True) -> Problem:
    """Register a new problem into the in-memory registry and optionally persist to disk."""
    PROBLEMS[problem.id] = problem
    if persist:
        save_problems_to_disk()
    return problem


def get_problem(problem_id: str) -> Optional[Problem]:
    """Look up a problem by its unique ID."""
    return PROBLEMS.get(problem_id)


def list_problems() -> List[Problem]:
    """Retrieve all available problems in the registry."""
    return list(PROBLEMS.values())


# Load any existing persisted problems on module import
load_problems_from_disk()
