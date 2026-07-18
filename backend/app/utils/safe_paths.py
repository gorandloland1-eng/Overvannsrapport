import re


def safe_folder_name(value: str | None, fallback: str = "Ukjent_prosjekt") -> str:
    value = (value or "").strip()
    if not value:
        return fallback

    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", value)
    value = re.sub(r"\s+", "_", value)
    value = value.strip("._ ")
    return value[:100] or fallback


def safe_download_filename(value: str | None, fallback: str = "fil") -> str:
    value = safe_folder_name(value, fallback=fallback)
    return value.replace("/", "_").replace("\\", "_")
