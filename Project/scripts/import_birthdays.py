import os
import re
from icalendar import Calendar
from supabase import create_client, Client
from datetime import datetime

# --- CONFIGURATION ---
# Set these as environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, USER_ID
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
USER_ID = os.environ.get("USER_ID", "")
ICS_FILE_PATH = "birthdays.ics"

def import_birthdays():
    if not os.path.exists(ICS_FILE_PATH):
        print(f"Error: {ICS_FILE_PATH} not found.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    with open(ICS_FILE_PATH, 'rb') as f:
        gcal = Calendar.from_ical(f.read())

    existing_events = supabase.table("events").select("title, start_time").eq("user_id", USER_ID).execute().data
    existing_keys = {f"{e['title']}_{e['start_time'][:10]}" for e in existing_events}

    count = 0
    for component in gcal.walk():
        if component.name == "VEVENT":
            summary = str(component.get('summary'))
            description = str(component.get('description', ''))
            start = component.get('dtstart').dt

            is_birthday = any(kw in summary.lower() for kw in ["birthday", "geburtstag"]) or \
                          "birthday" in description.lower() or \
                          "contact" in description.lower()

            if not is_birthday:
                continue

            name = re.sub(r'\s+(hat Geburtstag|birthday|Geburtstag).*$', '', summary, flags=re.IGNORECASE).strip()

            if isinstance(start, datetime):
                start_date = start.date()
            else:
                start_date = start

            start_iso = datetime.combine(start_date, datetime.min.time()).isoformat()

            day_month_key = f"{name}_{start_date.strftime('%m-%d')}"
            if any(day_month_key in k for k in existing_keys):
                print(f"Skipping duplicate: {name}")
                continue

            event_data = {
                "user_id": USER_ID,
                "title": name,
                "start_time": start_iso,
                "category": "birthday",
                "recurrence_type": "yearly",
                "is_all_day": True
            }

            try:
                supabase.table("events").insert(event_data).execute()
                print(f"Imported: {name} (Born: {start_date.year})")
                existing_keys.add(f"{name}_{start_iso[:10]}")
                count += 1
            except Exception as e:
                print(f"Failed to import {name}: {e}")

    print(f"\nFinished! Successfully imported {count} new birthdays.")

if __name__ == "__main__":
    if not SUPABASE_KEY or not USER_ID:
        print("Please set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and USER_ID as environment variables.")
    else:
        import_birthdays()
