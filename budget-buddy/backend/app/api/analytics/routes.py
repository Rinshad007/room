from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.auth.dependencies import CurrentUser
from app.db.session import get_db
from app.utils.balance import compute_balance_summary

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def dashboard_summary(
    current_user: CurrentUser,
    db: Annotated[any, Depends(get_db)],
):
    """High-level dashboard: total expenses, balance summary."""
    # Total expenses user is involved in (paid or split)
    total_expenses = await db["expenses"].count_documents({
        "$or": [
            {"paid_by": current_user.id},
            {"splits.user_id": current_user.id}
        ]
    })

    # Total amount spent (as payer)
    cursor = db["expenses"].aggregate([
        {"$match": {"paid_by": current_user.id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ])
    spent_res = await cursor.to_list(length=1)
    total_spent = float(spent_res[0]["total"]) if spent_res else 0.0

    balance = await compute_balance_summary(db, current_user.id)

    return {
        "total_expenses": total_expenses,
        "total_spent": total_spent,
        **balance,
    }


@router.get("/monthly")
async def monthly_expenses(
    year: int = Query(..., description="Year e.g. 2024"),
    current_user: CurrentUser = None,
    db: Annotated[any, Depends(get_db)] = None,
):
    """Monthly expense totals for the given year."""
    pipeline = [
        {
            "$match": {
                "splits": {
                    "$elemMatch": {
                        "user_id": current_user.id,
                        "status": "accepted"
                    }
                }
            }
        },
        {
            "$project": {
                "year": {"$year": "$expense_date"},
                "month": {"$month": "$expense_date"},
                "splits": 1
            }
        },
        {
            "$match": {
                "year": year
            }
        },
        {
            "$unwind": "$splits"
        },
        {
            "$match": {
                "splits.user_id": current_user.id,
                "splits.status": "accepted"
            }
        },
        {
            "$group": {
                "_id": "$month",
                "total": {"$sum": "$splits.share_amount"}
            }
        }
    ]
    cursor = db["expenses"].aggregate(pipeline)
    rows = await cursor.to_list(length=12)
    monthly = {int(r["_id"]): round(float(r["total"]), 2) for r in rows}
    return {"year": year, "data": [{"month": m, "total": monthly.get(m, 0.0)} for m in range(1, 13)]}


@router.get("/categories")
async def category_breakdown(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    current_user: CurrentUser = None,
    db: Annotated[any, Depends(get_db)] = None,
):
    """Category-wise expense breakdown for a given month."""
    pipeline = [
        {
            "$match": {
                "splits": {
                    "$elemMatch": {
                        "user_id": current_user.id,
                        "status": "accepted"
                    }
                }
            }
        },
        {
            "$project": {
                "year": {"$year": "$expense_date"},
                "month": {"$month": "$expense_date"},
                "category": 1,
                "splits": 1
            }
        },
        {
            "$match": {
                "year": year,
                "month": month
            }
        },
        {
            "$unwind": "$splits"
        },
        {
            "$match": {
                "splits.user_id": current_user.id,
                "splits.status": "accepted"
            }
        },
        {
            "$group": {
                "_id": "$category",
                "total": {"$sum": "$splits.share_amount"}
            }
        }
    ]
    cursor = db["expenses"].aggregate(pipeline)
    rows = await cursor.to_list(length=100)
    return {
        "month": month,
        "year": year,
        "data": [{"category": r["_id"], "total": round(float(r["total"]), 2)} for r in rows],
    }


@router.get("/trends")
async def spending_trends(
    months: int = Query(6, ge=1, le=12, description="Number of past months"),
    current_user: CurrentUser = None,
    db: Annotated[any, Depends(get_db)] = None,
):
    """Spending trend over the past N months."""
    pipeline = [
        {
            "$match": {
                "splits": {
                    "$elemMatch": {
                        "user_id": current_user.id,
                        "status": "accepted"
                    }
                }
            }
        },
        {
            "$project": {
                "year": {"$year": "$expense_date"},
                "month": {"$month": "$expense_date"},
                "splits": 1
            }
        },
        {
            "$unwind": "$splits"
        },
        {
            "$match": {
                "splits.user_id": current_user.id,
                "splits.status": "accepted"
            }
        },
        {
            "$group": {
                "_id": {"year": "$year", "month": "$month"},
                "total": {"$sum": "$splits.share_amount"}
            }
        },
        {
            "$sort": {"_id.year": 1, "_id.month": 1}
        },
        {
            "$limit": months
        }
    ]
    cursor = db["expenses"].aggregate(pipeline)
    rows = await cursor.to_list(length=months)
    return {
        "data": [
            {"year": int(r["_id"]["year"]), "month": int(r["_id"]["month"]), "total": round(float(r["total"]), 2)}
            for r in rows
        ]
    }
