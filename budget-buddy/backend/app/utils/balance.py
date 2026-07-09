from collections import defaultdict
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.expense import Expense, ExpenseSplit
from app.models.settlement import Settlement

async def compute_balance_summary(db: AsyncSession, user_id: str) -> dict:
    """Return total_payable, total_receivable, net_balance."""

    # ── What others OWE YOU: expenses where you PAID, all statuses ─────────
    stmt_recv = (
        select(ExpenseSplit)
        .join(Expense, Expense.id == ExpenseSplit.expense_id)
        .where(
            Expense.paid_by == user_id,
            ExpenseSplit.user_id != user_id,
        )
    )
    res_recv = await db.execute(stmt_recv)
    recv_splits = res_recv.scalars().all()
    total_receivable = sum(float(s.share_amount) for s in recv_splits)

    # ── What YOU OWE others: only your accepted splits where you didn't pay ─
    stmt_pay = (
        select(ExpenseSplit)
        .join(Expense, Expense.id == ExpenseSplit.expense_id)
        .where(
            ExpenseSplit.user_id == user_id,
            Expense.paid_by != user_id,
            ExpenseSplit.status == "accepted",
        )
    )
    res_pay = await db.execute(stmt_pay)
    pay_splits = res_pay.scalars().all()
    total_payable = sum(float(s.share_amount) for s in pay_splits)

    # ── Reduce by completed AND pending settlements ───────────────────────
    # Pending settlements already represent in-flight payments — deducting them
    # prevents the payer from settling the same debt twice.
    stmt_settle = (
        select(Settlement)
        .where(
            Settlement.status.in_(["completed", "pending"]),
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
    net: dict[str, float] = defaultdict(float)

    # Others owe YOU — all their splits on expenses YOU paid
    stmt_recv = (
        select(ExpenseSplit, Expense.paid_by)
        .join(Expense, Expense.id == ExpenseSplit.expense_id)
        .where(
            Expense.paid_by == user_id,
            ExpenseSplit.user_id != user_id,
        )
    )
    res_recv = await db.execute(stmt_recv)
    for split, _ in res_recv.all():
        net[split.user_id] += float(split.share_amount)

    # YOU owe others — only your accepted splits where someone else paid
    stmt_pay = (
        select(ExpenseSplit, Expense.paid_by)
        .join(Expense, Expense.id == ExpenseSplit.expense_id)
        .where(
            ExpenseSplit.user_id == user_id,
            Expense.paid_by != user_id,
            ExpenseSplit.status == "accepted",
        )
    )
    res_pay = await db.execute(stmt_pay)
    for split, paid_by in res_pay.all():
        net[paid_by] -= float(split.share_amount)

    # Apply completed AND pending settlements
    # Pending = in-flight payment — still reduce balances to prevent duplicates
    stmt_settle = (
        select(Settlement)
        .where(
            Settlement.status.in_(["completed", "pending"]),
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
