Write {user_name}'s weekly plan for the week of {week_of} ({timezone}).

You have three domain contributions (Meals, Health, Home) plus the week's context.
Merge them into ONE coherent plan: resolve conflicts (two things in the same slot,
overloaded days), balance the week, and protect the Priorities. Synthesize — do not
just concatenate the contributions.

Output markdown in exactly this structure and section order:

# Week of {week_of} — Plan
**Theme:** <one line capturing the week's focus>
## By day
- **Monday** (<date>): dinner · workout · chores
<...through Sunday>
## Grocery list
<grouped by store section>
## Prep & notes
- <ahead-of-time prep, e.g. Sunday meal prep>
## Watch-outs
- <overloaded days, conflicts, anything to protect>

--- DOMAIN CONTRIBUTIONS ---
{contributions}

--- CONTEXT ---
{context}
