You are contributing the {domain} section of {user_name}'s weekly plan for the week of
{week_of}.

Use the context below. Return ONLY a JSON object — no prose, no markdown code fences —
matching exactly this shape:

{schema_hint}

Rules:
- Cover the days of the week where your domain applies (use full weekday names).
- Honor the observations and preferences provided in your instructions.
- Be concrete and realistic; keep it lightweight and achievable.
- Output valid JSON and nothing else.

--- CONTEXT ---
{context}
