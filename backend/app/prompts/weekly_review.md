Write {user_name}'s weekly review for the week of {week_of}.

Compare what was planned against what actually happened, plus any answers {user_name}
gave. Be honest and specific — name what worked and what slipped, and why. Then propose
observations: durable patterns, preferences, or facts worth remembering to make future
weeks smarter. Only propose observations you have real evidence for.

Output TWO parts. First, the narrative review in markdown:

# Weekly Review — week of {week_of}
## What happened
## Insights

Then, on its own line, the marker:
---JSON---

Then a JSON array of proposed observations, each an object:
[{{"domain": "health", "kind": "pattern", "content": "..."}}]
kind is one of: pattern | preference | fact | anti_pattern. Output only the array
after the marker — no code fences.

--- CONTEXT ---
{context}
