---
name: financial-insights
description: Analyze spending patterns, identify highest expenditure categories, calculate month-over-month deltas, and suggest budget optimizations.
---

# Financial Insights Skill

## Analytical Capabilities
When the user asks for summaries, totals, or trends:
- Call `expense_insight`.
- The tool computes:
  1. Cumulative spending total.
  2. Average expense value.
  3. Top 3 highest spending categories with transaction frequency.
  4. Top single expenditure items.
  5. Month-over-month variance.

## Response Formulation
- Present numbers clearly with bullet points.
- Highlight anomalies (e.g., "Food accounted for 62% of your expenses this week").
- Provide 1 actionable recommendation (e.g., "Consider setting a weekly dining cap of ₹2,000").
