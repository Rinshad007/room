"""
Split calculation engine.
Supports three split types:
  - equal: divide total equally among participants
  - percentage: each participant owes their percentage of total
  - custom: explicit amounts per user (must sum to total)
"""
from typing import Optional
from app.api.expenses.schemas import SplitEntry


def calculate_equal_splits(
    total: float, participant_ids: list[str]
) -> dict[str, float]:
    """Divide total evenly. Remainder cent goes to first participant."""
    n = len(participant_ids)
    base = round(total / n, 2)
    remainder = round(total - base * n, 2)
    splits = {uid: base for uid in participant_ids}
    if remainder:
        splits[participant_ids[0]] = round(splits[participant_ids[0]] + remainder, 2)
    return splits


def calculate_percentage_splits(
    total: float, details: list[SplitEntry]
) -> dict[str, float]:
    """Convert percentages to amounts. Handles floating-point rounding."""
    splits = {}
    allocated = 0.0
    for i, entry in enumerate(details):
        if i == len(details) - 1:
            # Last entry gets the remainder to avoid rounding drift
            splits[entry.user_id] = round(total - allocated, 2)
        else:
            amount = round(total * entry.value / 100, 2)
            splits[entry.user_id] = amount
            allocated += amount
    return splits


def calculate_custom_splits(details: list[SplitEntry]) -> dict[str, float]:
    """Use explicit custom amounts."""
    return {entry.user_id: round(entry.value, 2) for entry in details}


def compute_splits(
    total: float,
    split_type: str,
    participants: list[str],
    details: Optional[list[SplitEntry]],
) -> dict[str, float]:
    """Master dispatcher for split computation."""
    if split_type == "equal":
        return calculate_equal_splits(total, participants)
    elif split_type == "percentage":
        if not details:
            raise ValueError("split_details required for percentage split")
        return calculate_percentage_splits(total, details)
    elif split_type == "custom":
        if not details:
            raise ValueError("split_details required for custom split")
        return calculate_custom_splits(details)
    else:
        raise ValueError(f"Unknown split type: {split_type}")
