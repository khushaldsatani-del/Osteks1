import re

# "Ofl" (Oberfläche) in a VW 13750 surface-protection designation — "VW 13750
# Ofl-x633 TL 227" — always ends in the LETTER l. Read off a drawing, though,
# that l is routinely returned as the digit 1 ("Of1"), a capital I ("OfI") or
# a pipe ("Of|"), and the O as a zero or the whole prefix in capitals ("OF1",
# "OFL"). This rewrites every such prefix to the one canonical spelling,
# "Ofl", and touches nothing else.
#
# Only a prefix that is directly followed by a coating code (one letter plus
# three digits — the same shape kb_repo.extract_ofl_codes looks for) is
# rewritten, so ordinary words and numbers elsewhere in the text are never
# altered. The code itself is left exactly as read.
_OFL_PREFIX_RE = re.compile(
    r"(?i)(?<![a-z])[o0]f[ \t]?[l1i|!](?=[^0-9a-z]*[a-z][^0-9a-z]*[0-9oli|sbz]{3}(?![0-9a-z]))"
)


def normalize_ofl_designation(text: str) -> str:
    if not text:
        return text
    return _OFL_PREFIX_RE.sub("Ofl", text)
