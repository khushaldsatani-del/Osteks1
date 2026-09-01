import re

import fitz  # PyMuPDF

# Pure PDF-text utilities for the standards/document knowledge base —
# deliberately contains NO AI/OpenAI calls of any kind. extract_pages()/
# build_marked_text() were used by the now-removed standalone CLI (Claude
# read their output directly and hand-built bundle dicts matching
# kb_repo.create_document()'s expected shape); the already-extracted data
# they produced is unaffected and lives on in the DB. normalize_document_
# number() below is still very much live — kb_repo.lookup_specification()
# (backing the Specification feature) depends on it.


def normalize_document_number(base_document_number: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (base_document_number or "").upper())


def extract_pages(buffer: bytes) -> list[str]:
    doc = fitz.open(stream=buffer, filetype="pdf")
    try:
        return [doc[i].get_text() for i in range(len(doc))]
    finally:
        doc.close()


def build_marked_text(pages: list[str]) -> str:
    return "\n\n".join(f"--- Page {index + 1} ---\n{text}" for index, text in enumerate(pages))
