from collections import defaultdict

async def compute_balance_summary(db, user_id: str) -> dict:
    """Return total_payable, total_receivable, net_balance."""
    # Accepted splits involving the user
    cursor = db["expenses"].find({
        "splits.status": "accepted",
        "$or": [
            {"splits.user_id": user_id},
            {"paid_by": user_id}
        ]
    })
    rows = await cursor.to_list(length=5000)

    total_payable = 0.0       # user owes others
    total_receivable = 0.0    # others owe user

    for exp in rows:
        paid_by = exp["paid_by"]
        for split in exp.get("splits", []):
            if split["status"] != "accepted":
                continue
            if split["user_id"] == user_id and paid_by != user_id:
                total_payable += float(split["share_amount"])
            elif paid_by == user_id and split["user_id"] != user_id:
                total_receivable += float(split["share_amount"])

    # Reduce by completed settlements
    cursor = db["settlements"].find({
        "status": "completed",
        "$or": [
            {"payer_id": user_id},
            {"receiver_id": user_id}
        ]
    })
    settlements = await cursor.to_list(length=5000)
    for s in settlements:
        if s["payer_id"] == user_id:
            total_payable -= float(s["amount"])
        else:
            total_receivable -= float(s["amount"])

    total_payable = max(0.0, round(total_payable, 2))
    total_receivable = max(0.0, round(total_receivable, 2))
    net_balance = round(total_receivable - total_payable, 2)

    return {
        "total_payable": total_payable,
        "total_receivable": total_receivable,
        "net_balance": net_balance,
    }


async def compute_user_balances(db, user_id: str) -> list[dict]:
    """Return per-user balance breakdown (who owes who what)."""
    cursor = db["expenses"].find({
        "splits.status": "accepted",
        "$or": [
            {"splits.user_id": user_id},
            {"paid_by": user_id}
        ]
    })
    rows = await cursor.to_list(length=5000)

    # net[other_user_id] > 0 means they owe us; < 0 means we owe them
    net = defaultdict(float)

    for exp in rows:
        paid_by = exp["paid_by"]
        for split in exp.get("splits", []):
            if split["status"] != "accepted":
                continue
            if split["user_id"] == user_id and paid_by != user_id:
                net[paid_by] -= float(split["share_amount"])
            elif paid_by == user_id and split["user_id"] != user_id:
                net[split["user_id"]] += float(split["share_amount"])

    # Apply settlements
    cursor = db["settlements"].find({
        "status": "completed",
        "$or": [
            {"payer_id": user_id},
            {"receiver_id": user_id}
        ]
    })
    settlements = await cursor.to_list(length=5000)
    for s in settlements:
        if s["payer_id"] == user_id:
            net[s["receiver_id"]] += float(s["amount"])
        else:
            net[s["payer_id"]] -= float(s["amount"])

    return [
        {"user_id": uid, "balance": round(bal, 2)}
        for uid, bal in net.items()
        if abs(bal) > 0.01
    ]
