from collections import defaultdict
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.expense import Expense, ExpenseSplit
from app.models.settlement import Settlement

async def compute_balance_summary(db: AsyncSession, user_id: str) -> dict:
    """Return total_payable, total_receivable, net_balance."""
    # Find all accepted splits involving the user
    stmt = (
        select(Expense)
        .join(ExpenseSplit)
        .where(
            ExpenseSplit.status == "accepted",
            or_(
                ExpenseSplit.user_id == user_id,
                Expense.paid_by == user_id
            )
        )
        .options(selectinload(Expense.splits))
    )
    result = await db.execute(stmt)
    expenses = result.scalars().unique().all()

    total_payable = 0.0       # user owes others
    total_receivable = 0.0    # others owe user

    for exp in expenses:
        paid_by = exp.paid_by
        for split in exp.splits:
            if split.status != "accepted":
                continue
            if split.user_id == user_id and paid_by != user_id:
                total_payable += float(split.share_amount)
            elif paid_by == user_id and split.user_id != user_id:
                total_receivable += float(split.share_amount)

    # Reduce by completed settlements
    stmt_settle = (
        select(Settlement)
        .where(
            Settlement.status == "completed",
            or_(
                Settlement.payer_id == user_id,
                Settlement.receiver_id == user_id
            )
        )
    )
    result_settle = await db.execute(stmt_settle)
    settlements = result_settle.scalars().all()
    
    for s in settlements:
        if s.payer_id == user_id:
            total_payable -= float(s.amount)
        else:
            total_receivable -= float(s.amount)

    total_payable = max(0.0, round(total_payable, 2))
    total_receivable = max(0.0, round(total_receivable, 2))
    net_balance = round(total_receivable - total_payable, 2)

    return {
        "total_payable": total_payable,
        "total_receivable": total_receivable,
        "net_balance": net_balance,
    }


async def compute_user_balances(db: AsyncSession, user_id: str) -> list[dict]:
    """Return per-user balance breakdown (who owes who what)."""
    stmt = (
        select(Expense)
        .join(ExpenseSplit)
        .where(
            ExpenseSplit.status == "accepted",
            or_(
                ExpenseSplit.user_id == user_id,
                Expense.paid_by == user_id
            )
        )
        .options(selectinload(Expense.splits))
    )
    result = await db.execute(stmt)
    expenses = result.scalars().unique().all()

    net = defaultdict(float)

    for exp in expenses:
        paid_by = exp.paid_by
        for split in exp.splits:
            if split.status != "accepted":
                continue
            if split.user_id == user_id and paid_by != user_id:
                net[paid_by] -= float(split.share_amount)
            elif paid_by == user_id and split.user_id != user_id:
                net[split.user_id] += float(split.share_amount)

    # Apply settlements
    stmt_settle = (
        select(Settlement)
        .where(
            Settlement.status == "completed",
            or_(
                Settlement.payer_id == user_id,
                Settlement.receiver_id == user_id
            )
        )
    )
    result_settle = await db.execute(stmt_settle)
    settlements = result_settle.scalars().all()
    
    for s in settlements:
        if s.payer_id == user_id:
            net[s.receiver_id] += float(s.amount)
        else:
            net[s.payer_id] -= float(s.amount)

    return [
        {"user_id": uid, "balance": round(bal, 2)}
        for uid, bal in net.items()
        if abs(bal) > 0.01
    ]
