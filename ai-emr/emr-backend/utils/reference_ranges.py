"""
Khulna Advanced Medical Instituition — Clinical Reference Range Database
Built from actual lab reports: Biochemistry, Hematology, Hormone, Immunology

Priority chain for status calculation:
1. Report explicitly marks H/L/Normal → use that
2. This database (sex + age aware) → calculate
3. PDF ref range fallback → calculate
4. Cannot determine → "Needs Review"
"""

# ── Critical thresholds (life-threatening values) ─────────────────────────────
# If value crosses these, status = "Critical High" or "Critical Low"
CRITICAL = {
    # name_lower              : (critical_low, critical_high)
    "hemoglobin"              : (7.0,    None),
    "hgb"                     : (7.0,    None),
    "glucose"                 : (40,     500),
    "rbs"                     : (40,     500),
    "cus"                     : (2.2,    27.8),
    "hba1c"                   : (None,   9.0),   # >9 = critically uncontrolled diabetes
    "potassium"               : (2.8,    6.5),
    "sodium"                  : (120,    160),
    "calcium"                 : (6.5,    13.0),
    "total wbc count"         : (2000,   30000),
    "wbc"                     : (2000,   30000),
    "total platelet count"    : (50000,  None),
    "platelet"                : (50000,  None),
    "s. creatinine"           : (None,   10.0),
    "creatinine"              : (None,   10.0),
    "s. bilirubin"            : (None,   15.0),
    "bilirubin"               : (None,   15.0),
    "sgpt"                    : (None,   1000),
    "sgot"                    : (None,   1000),
    "tsh"                     : (None,   10.0),  # >10 = severe hypothyroid
}

# ── Main reference range database ─────────────────────────────────────────────
# Structure: name_lower → {
#   "M": (min, max),          # male
#   "F": (min, max),          # female
#   "both": (min, max),       # unisex
#   "age": [(max_age, min, max), ...],  # age-based (sorted by age ascending)
#   "unit": "expected unit",
# }
#
# For age-based: list of (max_age_inclusive, ref_min, ref_max)
# matched by patient age <= max_age

RANGES = {

    # ══ BIOCHEMISTRY ════════════════════════════════════════════════════════

    "rbs": {
        "both": (70, 140),
        "unit": "mg/dl",
        "note": "Random Blood Sugar. Fasting: 70-100, Random: 70-140"
    },
    "cus": {
        "both": (3.9, 7.8),
        "unit": "mmol/l",
        "note": "Same as RBS in mmol/l"
    },
    "fbs": {
        "both": (70, 100),
        "unit": "mg/dl",
        "note": "Fasting Blood Sugar"
    },
    "hba1c": {
        "both": (4.0, 6.4),
        "unit": "%",
        "note": "Normal <6.4. Pre-diabetic 6.4-6.8. Diabetic >6.8. Poor control >7.75. Critical >9.0"
    },
    "s. creatinine": {
        "M": (0.7, 1.3),
        "F": (0.5, 1.1),
        "unit": "mg/dl"
    },
    "creatinine": {
        "M": (0.7, 1.3),
        "F": (0.5, 1.1),
        "unit": "mg/dl"
    },
    "blood urea": {
        "both": (10, 50),
        "unit": "mg/dl"
    },
    "urea": {
        "both": (10, 50),
        "unit": "mg/dl"
    },
    "s. bilirubin": {
        "both": (0.2, 1.2),
        "unit": "mg/dl",
        "note": "Total bilirubin. Direct: 0-0.3, Indirect: 0.2-0.9"
    },
    "bilirubin": {
        "both": (0.2, 1.2),
        "unit": "mg/dl"
    },
    "sgpt": {
        "M": (7, 45),
        "F": (7, 42),
        "unit": "U/L",
        "note": "ALT. Male ≤45, Female ≤42"
    },
    "alt": {
        "M": (7, 45),
        "F": (7, 42),
        "unit": "U/L"
    },
    "sgot": {
        "M": (10, 45),
        "F": (10, 40),
        "unit": "U/L",
        "note": "AST. Male ≤45, Female ≤40"
    },
    "ast": {
        "M": (10, 45),
        "F": (10, 40),
        "unit": "U/L"
    },
    "alkaline phosphatase": {
        "M": (44, 147),
        "F": (44, 147),
        "unit": "U/L",
        "note": "Lab uses 98-279 which is bone ALP range. Standard adult is 44-147. Trust lab range for this test."
    },
    "uric acid": {
        "M": (3.4, 7.0),
        "F": (2.4, 5.6),
        "unit": "mg/dl"
    },
    "calcium": {
        "both": (8.5, 10.5),
        "unit": "mg/dl"
    },
    "serum amylase": {
        "both": (28, 100),
        "unit": "U/L"
    },
    "urine amylase": {
        "both": (0, 1000),
        "unit": "U/L"
    },
    "s. albumin": {
        "both": (3.5, 5.0),
        "unit": "g/dl"
    },
    "albumin": {
        "both": (3.5, 5.0),
        "unit": "g/dl"
    },
    "total protein": {
        "both": (6.4, 8.3),
        "unit": "g/dl",
        "note": "Some labs use 6.6 as lower limit. 6.4 is borderline accepted."
    },
    "glucose": {
        "both": (70, 140),
        "unit": "mg/dl"
    },

    # ══ HEMATOLOGY ══════════════════════════════════════════════════════════

    "hemoglobin": {
        "M": (13.5, 17.5),
        "F": (11.5, 15.5),
        "unit": "g/dl",
        "note": "Sex-specific. Lab sometimes prints unisex 11-16 which misses male low values."
    },
    "hgb": {
        "M": (13.5, 17.5),
        "F": (11.5, 15.5),
        "unit": "g/dl"
    },
    "esr": {
        "M": (0, 10),
        "F": (0, 20),
        "unit": "mm/hr",
        "note": "Westergren method. Increases with age: >50y male up to 20, female up to 30"
    },
    "total wbc count": {
        "both": (4000, 11000),
        "unit": "/cmm",
        "note": "Lab prints 4000-10000. 11000 is accepted upper in many standards."
    },
    "wbc": {
        "both": (4000, 11000),
        "unit": "/cmm"
    },
    "neutrophils": {
        "both": (40, 75),
        "unit": "%"
    },
    "lymphocytes": {
        "both": (20, 45),
        "unit": "%"
    },
    "monocytes": {
        "both": (2, 10),
        "unit": "%"
    },
    "eosinophils": {
        "both": (1, 6),
        "unit": "%"
    },
    "basophils": {
        "both": (0, 1),
        "unit": "%"
    },
    "total platelet count": {
        "both": (150000, 450000),
        "unit": "/cmm"
    },
    "platelet": {
        "both": (150000, 450000),
        "unit": "/cmm"
    },
    "mpv": {
        "both": (7.5, 12.5),
        "unit": "fL"
    },
    "pdw": {
        "both": (9, 17),
        "unit": "%"
    },
    "pct": {
        "both": (0.10, 0.28),
        "unit": "%"
    },
    "rbc count": {
        "M": (4.5, 5.9),
        "F": (3.8, 5.2),
        "unit": "million/cmm",
        "note": "Lab uses unisex 3.5-5.5 which misses male low values"
    },
    "rbc": {
        "M": (4.5, 5.9),
        "F": (3.8, 5.2),
        "unit": "million/cmm"
    },
    "hct": {
        "M": (40, 52),
        "F": (36, 48),
        "unit": "%"
    },
    "hct(pcv)": {
        "M": (40, 52),
        "F": (36, 48),
        "unit": "%"
    },
    "pcv": {
        "M": (40, 52),
        "F": (36, 48),
        "unit": "%"
    },
    "mcv": {
        "both": (80, 100),
        "unit": "fL",
        "note": "Low MCV = microcytic (iron def, thalassemia). High = macrocytic (B12/folate def)"
    },
    "mch": {
        "both": (27, 33),
        "unit": "pg"
    },
    "mchc": {
        "both": (32, 36),
        "unit": "g/dl"
    },
    "rdw-sd": {
        "both": (37, 54),
        "unit": "fL"
    },
    "rdw-cv": {
        "both": (11.5, 14.5),
        "unit": "%"
    },
    "rdw": {
        "both": (11.5, 14.5),
        "unit": "%"
    },
    "p-lcr": {
        "both": (13, 43),
        "unit": "%"
    },

    # ══ HORMONE ══════════════════════════════════════════════════════════════

    "t3": {
        "both": (1.30, 3.10),
        "unit": "nmol/L"
    },
    "t4": {
        "both": (59.0, 154.0),
        "unit": "nmol/L"
    },
    "ft3": {
        "both": (3.10, 6.80),
        "unit": "pmol/L"
    },
    "ft4": {
        "both": (12.0, 22.0),
        "unit": "pmol/L"
    },
    "free thyroxine": {
        "both": (12.0, 22.0),
        "unit": "pmol/L"
    },
    "tsh": {
        "both": (0.40, 5.50),
        "unit": "uIU/ml",
        "note": "Euthyroid 0.4-5.5. Hyperthyroid <0.4. Hypothyroid >5.5. Critical >10"
    },
    "prolactin": {
        "M": (3.0, 14.7),
        "F": (3.8, 23.2),
        "unit": "ng/ml",
        "note": "Non-pregnancy female range. Pregnancy ranges much higher."
    },
    "progesterone": {
        "M": (0.13, 0.97),
        "F": (0.15, 25.0),   # using luteal phase max as upper bound
        "unit": "ng/ml",
        "note": "PHASE-DEPENDENT. Needs Review if phase unknown. Follicular:0.15-0.70, Luteal:2-25, Pregnancy 1st:10.3-44"
    },
    "lh": {
        "M": (1.27, 7.8),
        "F": (1.68, 15.0),   # follicular phase
        "unit": "miu/ml",
        "note": "PHASE-DEPENDENT for females. Using follicular phase range as default."
    },
    "fsh": {
        "M": (2.0, 10.0),
        "F": (2.0, 10.0),    # follicular = luteal range
        "unit": "miu/ml",
        "note": "PHASE-DEPENDENT. Mid-cycle: 7-20, Postmenopausal: 20-100"
    },
    "testosterone": {
        "M": (1.61, 8.41),
        "F": (0.0, 0.80),
        "unit": "ng/ml",
        "note": "Female >0.80 is significant finding (possible PCOS, adrenal issue)"
    },
    "estradiol": {
        "M": (20, 55),
        "F": (30, 400),      # wide range covers follicular+luteal
        "unit": "pg/ml",
        "note": "Phase-dependent for females"
    },
    "cortisol": {
        "both": (5, 25),
        "unit": "ug/dl",
        "note": "Morning (8AM) cortisol. Evening values are lower."
    },
    "insulin": {
        "both": (2.6, 24.9),
        "unit": "uIU/ml"
    },

    # ══ IMMUNOLOGY ═══════════════════════════════════════════════════════════

    # IgE is age-dependent — uses age_brackets
    "immunoglobulin ige": {
        "age_brackets": [
            (0.11, 0, 15),       # Up to 4 days: <15
            (1,    0, 25),       # Up to 12 months: <25
            (5,    0, 60),       # 1-5 years: <60
            (9,    0, 90),       # 6-9 years: <90
            (16,   0, 200),      # 10-16 years: <200
            (999,  0, 100),      # >16 years (adult): <100
        ],
        "unit": "IU/ml",
        "note": "Age-specific ranges. CRITICAL to use correct age bracket."
    },
    "ige": {
        "age_brackets": [
            (0.11, 0, 15),
            (1,    0, 25),
            (5,    0, 60),
            (9,    0, 90),
            (16,   0, 200),
            (999,  0, 100),
        ],
        "unit": "IU/ml"
    },
    "igg": {
        "both": (700, 1600),
        "unit": "mg/dl"
    },
    "iga": {
        "both": (70, 400),
        "unit": "mg/dl"
    },
    "igm": {
        "M": (40, 230),
        "F": (50, 300),
        "unit": "mg/dl"
    },
    "crp": {
        "both": (0, 6),
        "unit": "mg/L",
        "note": "C-Reactive Protein. <6 normal, 6-100 moderate inflammation, >100 severe"
    },
    "c-reactive protein": {
        "both": (0, 6),
        "unit": "mg/L"
    },
    "ana": {
        "both": (0, 1),
        "unit": "titre",
        "note": "Antinuclear Antibody. Negative = normal. Title >1:80 significant"
    },
    "rheumatoid factor": {
        "both": (0, 14),
        "unit": "IU/ml",
        "note": "<14 IU/ml = negative/normal"
    },
    "rf": {
        "both": (0, 14),
        "unit": "IU/ml"
    },
    "widal": {
        "both": (0, 80),
        "unit": "titre",
        "note": "Titre <1:80 normal. >1:160 significant for typhoid"
    },
    "hbsag": {
        "both": (0, 1),
        "unit": "index",
        "note": "Hepatitis B Surface Antigen. <1 = Non-reactive (Normal)"
    },
    "anti-hcv": {
        "both": (0, 1),
        "unit": "index",
        "note": "Hepatitis C Antibody. <1 = Non-reactive (Normal)"
    },
    "hiv": {
        "both": (0, 1),
        "unit": "index",
        "note": "Non-reactive = Normal"
    },
    "vdrl": {
        "both": (0, 1),
        "unit": "titre",
        "note": "Non-reactive = Normal"
    },
}

# ── Phase-dependent hormone tests (always flag for review if phase unknown) ───
PHASE_DEPENDENT = {
    "progesterone", "lh", "fsh", "estradiol"
}

# ── Tests where lab range should override DB range ────────────────────────────
# (because lab-specific analyzer calibration differs significantly)
TRUST_LAB_RANGE = {
    "alkaline phosphatase",   # lab uses bone ALP range which is valid for their analyzer
    "widal",                  # titre interpretation is lab-specific
    "hbsag",
    "anti-hcv",
    "hiv",
    "vdrl",
    "ana",
}


def get_status(name: str, value, unit: str = "",
               sex: str = "unknown", age=None,
               pdf_ref_min=None, pdf_ref_max=None) -> dict:
    """
    Calculate clinical status for a lab value.

    Returns:
        {
            "status": "Normal|High|Low|Critical High|Critical Low|Needs Review",
            "abnormal": bool,
            "ref_min": float,
            "ref_max": float,
            "source": "database|pdf|unknown"
        }
    """
    result = {
        "status": "Needs Review",
        "abnormal": False,
        "ref_min": pdf_ref_min,
        "ref_max": pdf_ref_max,
        "source": "unknown"
    }

    if value is None:
        return result

    try:
        val_str = str(value).strip()
        prefix  = ""
        if val_str.startswith("<"):
            prefix = "<"; val_str = val_str[1:]
        elif val_str.startswith(">"):
            prefix = ">"; val_str = val_str[1:]
        fval = float(val_str)
    except (ValueError, TypeError):
        return result

    name_lower = name.strip().lower()

    # ── Get reference range ──────────────────────────────────────────────────
    ref_min = None
    ref_max = None
    source  = "unknown"

    # Check if this test should use lab range as-is
    use_lab_range = name_lower in TRUST_LAB_RANGE

    if not use_lab_range and name_lower in RANGES:
        entry = RANGES[name_lower]

        # Age-bracket range (e.g. IgE)
        if "age_brackets" in entry and age is not None:
            try:
                age_f = float(str(age))
                for max_age, rmin, rmax in entry["age_brackets"]:
                    if age_f <= max_age:
                        ref_min, ref_max = rmin, rmax
                        source = "database_age"
                        break
            except (ValueError, TypeError):
                pass

        # Sex-specific range
        elif sex.upper() in ("M", "MALE") and "M" in entry:
            ref_min, ref_max = entry["M"]
            source = "database_sex"
        elif sex.upper() in ("F", "FEMALE") and "F" in entry:
            ref_min, ref_max = entry["F"]
            source = "database_sex"
        elif "both" in entry:
            ref_min, ref_max = entry["both"]
            source = "database"

    # Fallback to PDF range if DB has no entry or lab range trusted
    if ref_min is None and pdf_ref_min is not None:
        ref_min = float(pdf_ref_min)
        source  = "pdf"
    if ref_max is None and pdf_ref_max is not None:
        ref_max = float(pdf_ref_max)
        source  = "pdf"

    if ref_min is None or ref_max is None:
        result["source"] = source
        return result

    result["ref_min"] = ref_min
    result["ref_max"] = ref_max
    result["source"]  = source

    # ── Handle < / > prefix ──────────────────────────────────────────────────
    if prefix == "<":
        fval = fval - 0.001   # treat as just below the stated value
    elif prefix == ">":
        fval = fval + 0.001

    # ── Check critical thresholds first ──────────────────────────────────────
    crit = CRITICAL.get(name_lower)
    if crit:
        crit_low, crit_high = crit
        if crit_low  is not None and fval < crit_low:
            result["status"]   = "Critical Low"
            result["abnormal"] = True
            return result
        if crit_high is not None and fval > crit_high:
            result["status"]   = "Critical High"
            result["abnormal"] = True
            return result

    # ── Normal/High/Low ───────────────────────────────────────────────────────
    if fval < ref_min:
        result["status"]   = "Low"
        result["abnormal"] = True
    elif fval > ref_max:
        result["status"]   = "High"
        result["abnormal"] = True
    else:
        result["status"]   = "Normal"
        result["abnormal"] = False

    # ── Phase-dependent flag ──────────────────────────────────────────────────
    if name_lower in PHASE_DEPENDENT and result["status"] != "Normal":
        result["status"]  = "Needs Review"
        result["abnormal"] = True

    return result


def enrich_values(values: list, sex: str = "unknown", age=None) -> list:
    """
    Re-calculate status for a list of extracted values using the DB.
    Call this after Claude extraction to correct/improve status accuracy.

    values: list of dicts with keys: name, value, unit, ref_min, ref_max, status, abnormal
    Returns enriched list.
    """
    enriched = []
    for v in values:
        name     = v.get("name", "")
        val      = v.get("value")
        unit     = v.get("unit", "")
        pdf_min  = v.get("ref_min")
        pdf_max  = v.get("ref_max")
        cur_stat = v.get("status", "")

        # If report itself explicitly stated H/L/Normal/Critical — respect it
        # (Claude extracted it from the report text)
        explicit = cur_stat in ("High", "Low", "Normal", "Critical High", "Critical Low", "Abnormal")
        # But still upgrade to Critical if our DB says so
        db_result = get_status(name, val, unit, sex, age, pdf_min, pdf_max)

        if db_result["status"] in ("Critical High", "Critical Low"):
            # Always apply critical override
            v["status"]   = db_result["status"]
            v["abnormal"] = True
        elif explicit:
            # Keep what the report said, but update ref ranges from DB if better
            if db_result["source"] in ("database", "database_sex", "database_age"):
                v["ref_min"] = db_result["ref_min"]
                v["ref_max"] = db_result["ref_max"]
        else:
            # Apply DB calculation
            v["status"]   = db_result["status"]
            v["abnormal"] = db_result["abnormal"]
            if db_result["source"] in ("database", "database_sex", "database_age"):
                v["ref_min"] = db_result["ref_min"]
                v["ref_max"] = db_result["ref_max"]

        enriched.append(v)
    return enriched

