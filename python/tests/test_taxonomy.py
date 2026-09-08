"""Tests for the Python taxonomy bindings.

These mirror the TypeScript test suite case-for-case so the two packages can
never silently diverge.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from lexlatam_taxonomy import (
    VERSION,
    DocumentSubtype,
    DocumentType,
    clean_native,
    label,
    normalize,
    subtypes_of,
)

_DATA = json.loads(
    (Path(__file__).resolve().parents[1] / "lexlatam_taxonomy" / "data.json").read_text(
        encoding="utf-8"
    )
)


def test_version_matches_data_file() -> None:
    assert VERSION == _DATA["version"]


@pytest.mark.parametrize("native", list(_DATA["mappings"].keys()))
def test_every_mapping_round_trips(native: str) -> None:
    expected = _DATA["mappings"][native]
    doc_type, subtype = normalize(native)
    assert doc_type == DocumentType(expected["type"])
    if expected["subtype"] is None:
        assert subtype is None
    else:
        assert subtype == DocumentSubtype(expected["subtype"])


@pytest.mark.parametrize(
    ("native", "expected"),
    [
        ("Nota Marginal de Advertencia", "notice"),
        ("Fallo", "judgment"),
    ],
)
def test_panama_observed_native_labels(native: str, expected: str) -> None:
    assert normalize(native) == (DocumentType(expected), None)
    assert _DATA["mappings"][native] == {"type": expected, "subtype": None}


def test_fallback_resolution() -> None:
    assert normalize("Resolución del Pleno") == (
        DocumentType.RESOLUTION,
        DocumentSubtype.OTHER_RESOLUTION,
    )


def test_fallback_decree() -> None:
    assert normalize("Decreto Municipal No. 5") == (
        DocumentType.DECREE,
        DocumentSubtype.OTHER_DECREE,
    )


def test_fallback_agreement() -> None:
    assert normalize("Acuerdo Interinstitucional") == (
        DocumentType.AGREEMENT,
        DocumentSubtype.OTHER_AGREEMENT,
    )


def test_no_match_is_unknown() -> None:
    assert normalize("Memorando") == (DocumentType.UNKNOWN, None)
    assert normalize("") == (DocumentType.UNKNOWN, None)


def test_exact_mapping_wins_over_fallback() -> None:
    # "Resolución Ministerial" is an exact mapping; it must not fall through
    # to the generic "Resolución" -> other_resolution prefix fallback.
    assert normalize("Resolución Ministerial") == (
        DocumentType.RESOLUTION,
        DocumentSubtype.MINISTERIAL_RESOLUTION,
    )


@pytest.mark.parametrize(
    "raw",
    ["RESOLUCION del Pleno", "resolución del pleno", "RESOLUCIÓN DEL PLENO"],
)
def test_fallback_is_accent_and_case_insensitive(raw: str) -> None:
    assert normalize(raw) == (
        DocumentType.RESOLUTION,
        DocumentSubtype.OTHER_RESOLUTION,
    )


def test_clean_native_collapses_whitespace() -> None:
    assert clean_native("  Decreto   \n Ejecutivo  ") == "Decreto Ejecutivo"
    assert normalize("  Ley  ") == (DocumentType.LAW, None)


def test_label_default_is_spanish() -> None:
    assert label(DocumentType.LAW) == "Ley"
    assert label(DocumentSubtype.EXECUTIVE_DECREE) == "Decreto Ejecutivo"


def test_label_english() -> None:
    assert label(DocumentType.LAW, "en") == "Law"
    assert label(DocumentSubtype.EXECUTIVE_DECREE, "en") == "Executive Decree"


def test_subtypes_of() -> None:
    decree_subtypes = subtypes_of(DocumentType.DECREE)
    assert DocumentSubtype.EXECUTIVE_DECREE in decree_subtypes
    assert DocumentSubtype.OTHER_DECREE in decree_subtypes
    assert all(
        _DATA["subtypes"][s.value]["parent"] == "decree" for s in decree_subtypes
    )
    # A type with no subtypes returns an empty list.
    assert subtypes_of(DocumentType.LAW) == []


def test_code_and_constitution_are_type_only() -> None:
    # code/constitution are non-Gaceta type-only entries: labels, no subtypes,
    # and normalize() never resolves to them.
    assert label(DocumentType.CODE) == "Código"
    assert label(DocumentType.CONSTITUTION, "en") == "Constitution"
    assert subtypes_of(DocumentType.CODE) == []
    assert subtypes_of(DocumentType.CONSTITUTION) == []


def test_every_subtype_parent_is_a_real_type() -> None:
    type_values = {t.value for t in DocumentType}
    for subtype in DocumentSubtype:
        assert _DATA["subtypes"][subtype.value]["parent"] in type_values
