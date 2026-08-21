"""Contract tests for the Python legal-subject bindings."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from lexlatam_taxonomy import (
    CONTENT_CATEGORY_TO_LEGAL_SUBJECT,
    VERSION,
    DocumentType,
    LegalSubject,
    label,
    legal_subject_label,
)

_DATA = json.loads(
    (
        Path(__file__).resolve().parents[1]
        / "lexlatam_taxonomy"
        / "legal-subjects.json"
    ).read_text(encoding="utf-8")
)

EXPECTED_LABELS = {
    "administrative": "Administrativo",
    "banking_finance": "Bancario y financiero",
    "civil": "Civil",
    "civil_procedure": "Procesal civil",
    "commercial": "Comercial",
    "constitutional": "Constitucional",
    "consumer": "Consumo",
    "corporate": "Societario",
    "criminal": "Penal",
    "criminal_procedure": "Procesal penal",
    "employment": "Laboral",
    "environmental": "Ambiental",
    "family": "Familia",
    "immigration": "Migratorio",
    "maritime": "Marítimo",
    "property_real_estate": "Propiedad inmobiliaria",
    "public_procurement": "Contrataciones públicas",
    "social_security": "Seguridad social",
    "tax": "Tributario",
    "other": "Otros",
    "unknown": "Sin clasificar",
}


def test_exact_approved_identifiers_and_spanish_labels() -> None:
    assert {subject.value for subject in LegalSubject} == set(EXPECTED_LABELS)
    assert {
        identifier: item["label_es"]
        for identifier, item in _DATA["subjects"].items()
    } == EXPECTED_LABELS


@pytest.mark.parametrize("subject", list(LegalSubject))
def test_label_defaults_to_normative_spanish(subject: LegalSubject) -> None:
    assert legal_subject_label(subject) == EXPECTED_LABELS[subject.value]
    assert legal_subject_label(subject, "es") == EXPECTED_LABELS[subject.value]


@pytest.mark.parametrize("subject", list(LegalSubject))
def test_english_is_explicit_and_never_falls_back(subject: LegalSubject) -> None:
    with pytest.raises(ValueError, match="No 'en' label"):
        legal_subject_label(subject, "en")


def test_invalid_subject_type_and_locale_are_rejected() -> None:
    with pytest.raises(TypeError, match="Expected LegalSubject"):
        legal_subject_label(DocumentType.LAW)  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="Unsupported locale"):
        legal_subject_label(LegalSubject.CIVIL, "fr")  # type: ignore[arg-type]


def test_other_and_unknown_have_distinct_semantics() -> None:
    assert LegalSubject.OTHER != LegalSubject.UNKNOWN
    assert legal_subject_label(LegalSubject.OTHER) == "Otros"
    assert legal_subject_label(LegalSubject.UNKNOWN) == "Sin clasificar"
    assert label(DocumentType.UNKNOWN) == "Desconocido"


def test_content_category_crosswalk_is_exact_and_typed() -> None:
    expected = {
        "administrative": "administrative",
        "civil": "civil",
        "commercial": "commercial",
        "constitutional": "constitutional",
        "consumer": "consumer",
        "criminal": "criminal",
        "employment": "employment",
        "family": "family",
        "immigration": "immigration",
        "other": "other",
        "procedural": "unknown",
        "property": "property_real_estate",
        "social_security": "social_security",
        "tax": "tax",
    }
    assert _DATA["content_category_crosswalk"] == expected
    assert {
        source: subject.value
        for source, subject in CONTENT_CATEGORY_TO_LEGAL_SUBJECT.items()
    } == expected
    assert CONTENT_CATEGORY_TO_LEGAL_SUBJECT["procedural"] is LegalSubject.UNKNOWN
    assert (
        CONTENT_CATEGORY_TO_LEGAL_SUBJECT["property"]
        is LegalSubject.PROPERTY_REAL_ESTATE
    )


def test_version_matches_legal_subject_data() -> None:
    assert VERSION == _DATA["version"] == "1.2.0"
