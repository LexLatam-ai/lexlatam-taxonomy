"""Hand-written, stable public API for the LexLatam taxonomy.

The taxonomy data itself is loaded from the bundled ``data.json`` (a verbatim
copy of ``data/document-types.json``). This module never hard-codes type lists;
see :mod:`lexlatam_taxonomy.types` for the generated enums.
"""

from __future__ import annotations

import json
import re
import unicodedata
from importlib.resources import files

from .types import DocumentSubtype, DocumentType

__all__ = [
    "VERSION",
    "normalize",
    "label",
    "subtypes_of",
    "clean_native",
]

_DATA = json.loads(
    (files(__package__) / "data.json").read_text(encoding="utf-8")
)

#: Semantic version of the taxonomy data this package was generated from.
VERSION: str = _DATA["version"]

_TYPES: dict[str, dict[str, str]] = _DATA["types"]
_SUBTYPES: dict[str, dict[str, str]] = _DATA["subtypes"]
_MAPPINGS: dict[str, dict[str, str | None]] = _DATA["mappings"]
_FALLBACKS: list[dict[str, str | None]] = _DATA["fallbacks"]

_WHITESPACE = re.compile(r"\s+")


def clean_native(raw: str) -> str:
    """Trim and collapse internal whitespace in a raw native Gaceta string."""
    return _WHITESPACE.sub(" ", raw).strip()


def _fold(value: str) -> str:
    """Lower-case and strip accents for accent-insensitive comparison."""
    decomposed = unicodedata.normalize("NFD", value)
    stripped = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    return stripped.lower()


def normalize(raw: str) -> tuple[DocumentType, DocumentSubtype | None]:
    """Resolve a raw native Gaceta string to a canonical (type, subtype).

    An exact mapping is tried first; failing that, the ordered, accent- and
    case-insensitive prefix fallbacks are applied. A string matching nothing
    resolves to ``(DocumentType.UNKNOWN, None)``.
    """
    cleaned = clean_native(raw)

    exact = _MAPPINGS.get(cleaned)
    if exact is not None:
        return _resolve(exact["type"], exact["subtype"])

    folded = _fold(cleaned)
    for fallback in _FALLBACKS:
        if folded.startswith(_fold(str(fallback["prefix"]))):
            return _resolve(fallback["type"], fallback["subtype"])

    return DocumentType.UNKNOWN, None


def _resolve(
    type_: str | None, subtype: str | None
) -> tuple[DocumentType, DocumentSubtype | None]:
    return (
        DocumentType(type_),
        DocumentSubtype(subtype) if subtype is not None else None,
    )


def label(t: DocumentType | DocumentSubtype, lang: str = "es") -> str:
    """Return the human-readable label for a type or subtype.

    ``lang`` accepts ``"es"`` (default) or ``"en"``.
    """
    key = "label_en" if lang == "en" else "label_es"
    if isinstance(t, DocumentType):
        return _TYPES[t.value][key]
    if isinstance(t, DocumentSubtype):
        return _SUBTYPES[t.value][key]
    raise TypeError(f"Expected DocumentType or DocumentSubtype, got {type(t)!r}")


def subtypes_of(t: DocumentType) -> list[DocumentSubtype]:
    """Return every subtype whose parent is the given type, in data order."""
    return [
        DocumentSubtype(name)
        for name, sub in _SUBTYPES.items()
        if sub["parent"] == t.value
    ]
