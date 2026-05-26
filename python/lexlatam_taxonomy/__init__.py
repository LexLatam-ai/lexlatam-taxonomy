"""LexLatam Gaceta Oficial de Panamá legal-document taxonomy.

Language-neutral source of truth shared across the LexLatam services. The
public API is intentionally small and stable: :func:`normalize`, :func:`label`,
:func:`subtypes_of`, :func:`clean_native`, and the :data:`VERSION` constant.
"""

from .taxonomy import VERSION, clean_native, label, normalize, subtypes_of
from .types import DocumentSubtype, DocumentType

__all__ = [
    "VERSION",
    "DocumentType",
    "DocumentSubtype",
    "normalize",
    "label",
    "subtypes_of",
    "clean_native",
]
