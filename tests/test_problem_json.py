"""
Unit tests for canonical JSON round-trip import and export (Schema v1.0).
"""

import json
import pytest

from problem_engine.json_io import (
    build_sample_problem_pack,
    export_problem_pack_json,
    import_problem_pack_json,
)
from problem_engine.problem_schema import CURRENT_SCHEMA_VERSION


def test_build_sample_problem_pack():
    pack = build_sample_problem_pack()
    assert pack.schema_version == CURRENT_SCHEMA_VERSION
    assert pack.total_problems == 2
    assert len(pack.problems) == 2
    assert pack.problems[0].problem_id == "P1"
    assert len(pack.problems[0].test_cases) >= 5
    assert pack.problems[1].problem_id == "P2"
    assert len(pack.problems[1].test_cases) >= 5


def test_canonical_roundtrip_serialization():
    pack = build_sample_problem_pack()
    json_str = export_problem_pack_json(pack)
    assert isinstance(json_str, str)
    assert '"schema_version": "1.0"' in json_str

    reloaded = import_problem_pack_json(json_str)
    assert reloaded.schema_version == pack.schema_version
    assert reloaded.problem_pack_id == pack.problem_pack_id
    assert reloaded.total_problems == pack.total_problems
    assert len(reloaded.problems) == len(pack.problems)
    assert reloaded.problems[0].title == pack.problems[0].title
    assert len(reloaded.problems[0].test_cases) == len(pack.problems[0].test_cases)


def test_import_unsupported_version():
    data = {
        "schema_version": "2.0",
        "problem_pack_id": "test",
        "problems": [],
    }
    with pytest.raises(ValueError) as exc:
        import_problem_pack_json(data)
    assert "Unsupported schema_version" in str(exc.value)


def test_import_missing_version():
    data = {
        "problem_pack_id": "test",
        "problems": [],
    }
    with pytest.raises(ValueError) as exc:
        import_problem_pack_json(data)
    assert "Missing 'schema_version' field" in str(exc.value)


def test_import_malformed_json_diagnostics():
    bad_json = '{ "schema_version": "1.0", "problems": "not_a_list" }'
    with pytest.raises(ValueError) as exc:
        import_problem_pack_json(bad_json)
    assert "ProblemPack schema validation failed" in str(exc.value)
    assert "problems" in str(exc.value)
