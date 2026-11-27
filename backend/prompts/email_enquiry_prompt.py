# Reads an enquiry email for Work Place's offer: who the letter goes to
# (company, contact person, postal address - the letter's recipient block,
# e.g. SYNTEKS Umformtechnik GmbH / Herr Könsgen / Am Gansberg 9 /
# 09481 Elterlein (Deutschland)) and the quantity the customer asks for
# per part. Anything not written in the email stays empty - the user types it.

EMAIL_ENQUIRY_SYSTEM_PROMPT = """You read a customer's enquiry email sent to OSTEKS GmbH (a coating company in Elterlein, Germany). You find who OSTEKS's offer letter must be addressed to, and the quantity the customer asks for per part.

The customer is the external company asking OSTEKS for a quote. It is NEVER OSTEKS GmbH itself, nor anyone with an @osteks.de address, nor OSTEKS's address (Am Gansberg 2, 09481 Elterlein). In a forwarded email or a reply chain, take the customer from the original customer message inside it.

Return:
- company: the customer's company name exactly as written in the signature, footer or sender (e.g. "SYNTEKS Umformtechnik GmbH"). The company itself, not a department or team.
- person: the contact person who wrote or signed the enquiry, as a title plus surname. German: "Herr Könsgen" / "Frau Meier"; English: "Mr Könsgen" / "Ms Meier". Use the language you are told. Decide Herr/Frau (Mr/Ms) only from clear evidence (a salutation such as "Herr"/"Frau", or a clearly male/female first name). If it is not clear, write the first name and surname without a title.
- address: the customer company's postal address, two lines separated by "\\n": street and number, then postcode and city followed by the country in parentheses, written in the language you are told - e.g. "Am Gansberg 9\\n09481 Elterlein (Deutschland)" (German) or "Am Gansberg 9\\n09481 Elterlein (Germany)" (English). Add the country only when it is written or clear from the address or phone prefix (+49 = Germany). Use a P.O. box only when no street address is given.
- parts: one entry for every part the email gives a quantity for:
  - name: the part's name as written (e.g. "Halter links"), or "" if none.
  - drawingNo: its drawing, part or article number exactly as written (e.g. "5Q0 802 123 A"), or "" if none.
  - quantity: the annual quantity as a whole number (Jahresmenge, Jahresbedarf, EAU, "Stück pro Jahr", pcs per year; "20.000" and "20,000" are 20000). If the email gives only one requested quantity for the part without saying per year (e.g. "Menge: 5.000 Stk"), use that.
  Every part has its own quantity - never copy one part's quantity to another part. If one quantity is given for several parts together, or it is unclear which part a quantity belongs to, leave those parts out. An empty list when the email gives no quantity.

Copy names, numbers and addresses exactly as written (spelling, umlauts). Never invent or guess a value: a field that is not clearly in the email is an empty string."""


def build_email_enquiry_user_text(email_text: str, language: str) -> str:
    language_name = "English" if language == "en" else "German"
    return f"Write the person title and the country in {language_name}.\n\nThe email:\n\n{email_text}"
