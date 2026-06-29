# AI extraction engine
import pdfplumber
import anthropic
import base64
import json
import os
import re
import io
from PIL import Image
from utils.reference_ranges import enrich_values

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Model config ──────────────────────────────────────────────────────────────
# Tier 1: Haiku — fast, cheap. Used first for digital PDFs and images.
# Tier 2: Sonnet — accurate. Fallback if Haiku returns too few values or errors.
# Scanned PDFs always use Sonnet (vision quality matters more).
HAIKU_MODEL  = os.getenv("CLAUDE_HAIKU_MODEL",  "claude-haiku-4-5")
SONNET_MODEL = os.getenv("CLAUDE_MODEL",         "claude-sonnet-4-5")

# If Haiku returns fewer values than this, escalate to Sonnet.
HAIKU_MIN_VALUES = int(os.getenv("HAIKU_MIN_VALUES", "1"))

DEFAULT_LAB_NAME = os.getenv("DEFAULT_LAB_NAME", "Nashman Institute")

EXTRACTION_PROMPT = """You are a medical lab report data extractor for a clinical EMR system.
Extract ALL test parameters from this lab report and return ONLY a valid JSON object.

CRITICAL RULES:
- NEVER skip any test parameter — extract every single value visible.
- Preserve decimal values exactly (e.g. 2.3, 125.6, 0.85).
- Preserve units exactly (g/dL, mmol/L, IU/L, mg/dl, mmol/l, %, U/L etc).

MULTI-TEST CELL HANDLING (very important):
- Some lab reports print two test names together in one row/cell, e.g. "RBS\nCUS" or "RBS, CUS" or "RBS / CUS".
- In this layout the FIRST value on that row belongs to the FIRST test name, and the SECOND value belongs to the SECOND test name.
- Example from a real report: "RBS\nCUS" with "85 mg/dl\n4.72 mmol/l" means RBS=85 mg/dl AND CUS=4.72 mmol/l — extract BOTH as separate entries.
- Never assign the second test's value to the first test name.
- If two test names appear stacked and two values/units are also stacked, match them positionally: first name = first value, second name = second value.

REFERENCE RANGE RULES:
- For reference ranges: use the range appropriate for patient sex/age if multiple ranges shown.
- "Up to 140" means ref_min=0, ref_max=140.
- ">7.75%" for HbA1c Poor Control is NOT the ref range — use the normal range (4.40-6.40).

STATUS RULES:
- If the report itself shows H/High/L/Low/Abnormal/Critical/Normal — use that exact classification.
- Otherwise calculate from value vs ref_min/ref_max.
- Possible values: "Normal", "High", "Low", "Critical High", "Critical Low", "Abnormal", "Needs Review"
- If value has < or > prefix (e.g. <0.5 or >500), handle correctly vs range.
- If status cannot be safely determined, use "Needs Review".

OTHER RULES:
- For "abnormal": true if status is NOT "Normal".
- For "value": must be a number (float). For values like "<0.5", use 0.5 as value and "<0.5" as value_text.
- For "lab_name": extract lab/institute/centre name visible in the report. Otherwise empty string.
- For "lab_id": extract the report/barcode/lab ID if visible. Otherwise empty string.
- For "test_date": extract date if visible, format YYYY-MM-DD.

Return this EXACT JSON structure (no extra fields, no markdown):
{
  "report_type": "Hematology|Hormone|Immunology|Biochemical|Other",
  "lab_name": "lab name if visible else empty string",
  "lab_id": "report ID if visible else empty string",
  "patient_name": "patient name if visible else empty string",
  "test_date": "YYYY-MM-DD if visible else empty string",
  "values": [
    {
      "name": "parameter name",
      "value": 11.1,
      "value_text": "11.1",
      "unit": "g/dL",
      "ref_min": 10.0,
      "ref_max": 14.0,
      "status": "Normal",
      "abnormal": false
    }
  ]
}

Return ONLY the JSON. No explanation. No markdown. No backticks."""


def detect_report_type(text: str) -> str:
    text_lower = text.lower()
    if any(k in text_lower for k in ["haematology","hematology","hemoglobin","wbc","rbc","platelet","cbc"]):
        return "Hematology"
    if any(k in text_lower for k in ["hormone","tsh","t3","t4","prolactin","lh","fsh","testosterone"]):
        return "Hormone"
    if any(k in text_lower for k in ["immunology","immunoglobulin","ige","iga","igg"]):
        return "Immunology"
    if any(k in text_lower for k in ["biochemical","biochemistry","glucose","creatinine","hba1c","sgpt","sgot","bilirubin"]):
        return "Biochemical"
    return "Other"


def _result_is_good(result: dict) -> bool:
    """Return True if extraction looks trustworthy enough to accept."""
    if result.get("error"):
        return False
    if len(result.get("values", [])) < HAIKU_MIN_VALUES:
        return False
    return True


def pdf_pages_to_images(pdf_path: str, dpi: int = 200) -> list:
    """Convert PDF pages to PNG bytes — tries pypdfium2 then pdf2image."""
    images = []
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(pdf_path)
        for i in range(len(pdf)):
            page = pdf[i]
            bitmap = page.render(scale=dpi / 72)
            pil_img = bitmap.to_pil()
            buf = io.BytesIO()
            pil_img.save(buf, format="PNG")
            images.append(buf.getvalue())
        return images
    except (ImportError, Exception):
        pass
    try:
        from pdf2image import convert_from_path
        for img in convert_from_path(pdf_path, dpi=dpi):
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            images.append(buf.getvalue())
        return images
    except (ImportError, Exception):
        pass
    return []


# ── Public entry points ───────────────────────────────────────────────────────

def extract_from_pdf(pdf_path: str, patient_sex: str = "Female") -> dict:
    """Digital PDFs: Haiku first → Sonnet fallback. Scanned PDFs: Sonnet always."""
    try:
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"

        if text.strip() and len(text.strip()) > 50:
            result = _call_text_model(text, patient_sex, HAIKU_MODEL)
            if not _result_is_good(result):
                print(f"[extractor] Haiku got {len(result.get('values',[]))} values — escalating to Sonnet")
                result = _call_text_model(text, patient_sex, SONNET_MODEL)
                result["_escalated"] = True
            result["_method"] = "digital_pdf_text"
            return result
        else:
            return _scanned_pdf(pdf_path, patient_sex)

    except Exception as e:
        return {"error": str(e), "values": []}


def extract_from_image_file(image_path: str, patient_sex: str = "Female") -> dict:
    """Images: Haiku vision first → Sonnet fallback."""
    if image_path.lower().endswith(".pdf"):
        return _scanned_pdf(image_path, patient_sex)

    try:
        with open(image_path, "rb") as f:
            data = f.read()
        ext = image_path.lower()
        if ext.endswith(".png"):   media_type = "image/png"
        elif ext.endswith(".gif"): media_type = "image/gif"
        elif ext.endswith(".webp"):media_type = "image/webp"
        else:                      media_type = "image/jpeg"

        b64 = base64.standard_b64encode(data).decode("utf-8")
        result = _call_vision_model(b64, media_type, patient_sex, HAIKU_MODEL)
        if not _result_is_good(result):
            print(f"[extractor] Haiku vision insufficient — escalating to Sonnet")
            result = _call_vision_model(b64, media_type, patient_sex, SONNET_MODEL)
            result["_escalated"] = True
        result["_method"] = "image_vision"
        return result
    except Exception as e:
        return {"error": str(e), "values": []}


# ── Internal callers ──────────────────────────────────────────────────────────

def _scanned_pdf(pdf_path: str, patient_sex: str) -> dict:
    """Scanned PDFs always use Sonnet for best vision accuracy."""
    images = pdf_pages_to_images(pdf_path)
    if not images:
        return {"error": "Could not render PDF pages. Install pypdfium2.", "values": []}
    if not ANTHROPIC_API_KEY:
        return {"error": "API key not set", "values": []}
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        content = []
        for img_bytes in images[:4]:
            b64 = base64.standard_b64encode(img_bytes).decode("utf-8")
            content.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}})
        content.append({"type": "text", "text": f"Patient Sex: {patient_sex}\n\nScanned lab report ({len(images)} page(s)). {EXTRACTION_PROMPT}"})
        response = client.messages.create(model=SONNET_MODEL, max_tokens=4000, messages=[{"role": "user", "content": content}])
        result = _safe_parse_json(response.content[0].text.strip(), patient_sex, None)
        result["_method"] = "scanned_pdf_vision"
        result["_model"]  = SONNET_MODEL
        return result
    except Exception as e:
        return {"error": str(e), "values": []}


def _call_text_model(text: str, patient_sex: str, model: str) -> dict:
    if not ANTHROPIC_API_KEY:
        return _fallback_parse(text)
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        prompt = f"Patient Sex: {patient_sex}\n\nLab Report Text:\n{text}\n\n{EXTRACTION_PROMPT}"
        response = client.messages.create(model=model, max_tokens=4000, messages=[{"role": "user", "content": prompt}])
        result = _safe_parse_json(response.content[0].text.strip(), patient_sex, None)
        result["_model"] = model
        return result
    except Exception as e:
        return {"error": str(e), "values": [], "_model": model}


def _call_vision_model(b64_data: str, media_type: str, patient_sex: str, model: str) -> dict:
    if not ANTHROPIC_API_KEY:
        return {"error": "API key not set", "values": []}
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=model, max_tokens=4000,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64_data}},
                {"type": "text", "text": f"Patient Sex: {patient_sex}\n\n{EXTRACTION_PROMPT}"}
            ]}]
        )
        result = _safe_parse_json(response.content[0].text.strip(), patient_sex, None)
        result["_model"] = model
        return result
    except Exception as e:
        return {"error": str(e), "values": [], "_model": model}


def _safe_parse_json(raw: str, patient_sex: str = "unknown", patient_age=None) -> dict:
    try:
        clean = re.sub(r"```json\s*", "", raw)
        clean = re.sub(r"```\s*", "", clean).strip()
        parsed = json.loads(clean)

        if not parsed.get("lab_name"):
            parsed["lab_name"] = DEFAULT_LAB_NAME

        for v in parsed.get("values", []):
            if not v.get("value_text"):
                v["value_text"] = str(v.get("value", "")) if v.get("value") is not None else ""

        sex = patient_sex or "unknown"
        age = patient_age

        parsed["values"] = enrich_values(parsed.get("values", []), sex=sex, age=age)
        return parsed
    except Exception:
        return {"error": "JSON parse failed", "raw": raw[:500], "values": []}


def _fallback_parse(text: str) -> dict:
    return {
        "report_type": detect_report_type(text),
        "lab_name": DEFAULT_LAB_NAME,
        "lab_id": "", "test_date": "", "values": [],
        "note": "API key not configured — values not extracted"
    }
