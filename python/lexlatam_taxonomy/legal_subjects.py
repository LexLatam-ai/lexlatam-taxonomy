"""Stable public API for the LexLatam legal-subject taxonomy."""

from __future__ import annotations

import json
from importlib.resources import files
from types import MappingProxyType
from typing import Literal, Mapping

from .types import LegalSubject

__all__ = [
    "CONTENT_CATEGORY_TO_LEGAL_SUBJECT",
    "legal_subject_label",
]

_DATA = json.loads(
    (files(__package__) / "legal-subjects.json").read_text(encoding="utf-8")
)
_SUBJECTS: dict[str, dict[str, str]] = _DATA["subjects"]

CONTENT_CATEGORY_TO_LEGAL_SUBJECT: Mapping[str, LegalSubject] = MappingProxyType(
    {
        source: LegalSubject(target)
        for source, target in _DATA["content_category_crosswalk"].items()
    }
)


def legal_subject_label(
    subject: LegalSubject, locale: Literal["es", "en"] = "es"
) -> str:
    """Return the approved localized label for a legal subject.

    Spanish is normative and is always the default. English is available only
    when the canonical data explicitly defines it; there is no locale fallback.
    """
    if not isinstance(subject, LegalSubject):
        raise TypeError(f"Expected LegalSubject, got {type(subject)!r}")
    if locale not in ("es", "en"):
        raise ValueError(f"Unsupported locale: {locale}")

    key = f"label_{locale}"
    labels = _SUBJECTS[subject.value]
    try:
        return labels[key]
    except KeyError as exc:
        raise ValueError(
            f"No {locale!r} label is defined for legal subject {subject.value!r}"
        ) from exc
