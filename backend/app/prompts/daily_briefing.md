Today is {weekday}, {date_long} ({timezone}).

Write {user_name}'s daily briefing from the context below. Synthesize — do not list
raw data. Make decisions and name tradeoffs. Your output MUST follow this exact
markdown structure and section order:

# {weekday}, {date_long} — Briefing
**The one thing:** <single most important focus + why>
## Today's shape
<2-4 sentences narrating the day: energy, weather, load>
## Focus (max 3)
1. <focus item with a time anchor>
## Logistics
- Dinner: ... | Workout: ... | Errands/chores: ...
## Watch-outs
- <cracks: overdue items, upcoming birthdays, bills>
## Parked (and why)
- <lower-priority items deferred, each with a one-line reason>

--- CONTEXT ---
{context}
