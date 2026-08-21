"""LexLatam Gaceta Oficial de Panamá legal-document taxonomy.

Language-neutral source of truth shared across the LexLatam services. The
Document types and legal subjects are separate data domains with separate
helpers so their shared identifiers cannot collide.
"""

from .legal_subjects import CONTENT_CATEGORY_TO_LEGAL_SUBJECT, legal_subject_label
from .taxonomy import VERSION, clean_native, label, normalize, subtypes_of
from .types import DocumentSubtype, DocumentType, LegalSubject

__all__ = [
    "VERSION",
    "DocumentType",
    "DocumentSubtype",
    "LegalSubject",
    "CONTENT_CATEGORY_TO_LEGAL_SUBJECT",
    "normalize",
    "label",
    "subtypes_of",
    "clean_native",
    "legal_subject_label",
]
