import asyncio
import uuid
from datetime import datetime, date, timezone
from app.db.session import db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.friendship import Friendship
from app.models.group import Group, GroupMember
from app.models.expense import Expense, ExpenseSplit
from app.models.budget import Budget

async def seed():
    # Verify/create indexes
    from pymongo import ASCENDING
    await db["users"].create_index([("email", ASCENDING)], unique=True)

    # Check if demo user exists
    demo_doc = await db["users"].find_one({"email": "demo@budgetbuddy.app"})
    if not demo_doc:
        demo = User(
            name="Demo User",
            email="demo@budgetbuddy.app",
            password_hash=get_password_hash("Demo1234")
        )
        await db["users"].insert_one({
            "_id": demo.id,
            "name": demo.name,
            "email": demo.email,
            "password_hash": demo.password_hash,
            "avatar_url": demo.avatar_url,
            "created_at": demo.created_at,
            "updated_at": demo.updated_at
        })
    else:
        demo = User(**demo_doc)

    # Create demo friends (Rahul, Safvan, Arjun, Meera, Priya)
    friends_data = [
        {"name": "Rahul", "email": "rahul@budgetbuddy.app"},
        {"name": "Safvan", "email": "safvan@budgetbuddy.app"},
        {"name": "Arjun", "email": "arjun@budgetbuddy.app"},
        {"name": "Meera", "email": "meera@budgetbuddy.app"},
        {"name": "Priya", "email": "priya@budgetbuddy.app"}
    ]
    
    friends_list = []
    for fd in friends_data:
        u_doc = await db["users"].find_one({"email": fd["email"]})
        if not u_doc:
            u = User(
                name=fd["name"],
                email=fd["email"],
                password_hash=get_password_hash("Friend1234")
            )
            await db["users"].insert_one({
                "_id": u.id,
                "name": u.name,
                "email": u.email,
                "password_hash": u.password_hash,
                "avatar_url": u.avatar_url,
                "created_at": u.created_at,
                "updated_at": u.updated_at
            })
        else:
            u = User(**u_doc)
        friends_list.append(u)

    # Establish friendships (accepted status)
    for f in friends_list:
        existing = await db["friendships"].find_one({
            "$or": [
                {"sender_id": demo.id, "receiver_id": f.id},
                {"sender_id": f.id, "receiver_id": demo.id}
            ]
        })
        if not existing:
            friendship = Friendship(
                sender_id=demo.id,
                receiver_id=f.id,
                status="accepted"
            )
            await db["friendships"].insert_one({
                "_id": friendship.id,
                "sender_id": friendship.sender_id,
                "receiver_id": friendship.receiver_id,
                "status": friendship.status,
                "created_at": friendship.created_at,
                "updated_at": friendship.updated_at
            })

    # Create Groups (Goa Trip, Flat Expenses, Office Lunch)
    groups_data = [
        {"name": "Goa Trip", "desc": "Trip to Goa with friends"},
        {"name": "Flat Expenses", "desc": "Shared apartment bills"},
        {"name": "Office Lunch", "desc": "Lunch splits at work"}
    ]

    groups_list = []
    for gd in groups_data:
        g_doc = await db["groups"].find_one({"name": gd["name"]})
        if not g_doc:
            g = Group(
                name=gd["name"],
                description=gd["desc"],
                created_by=demo.id
            )
            
            members_list = [
                {
                    "id": str(uuid.uuid4()),
                    "user_id": demo.id,
                    "joined_at": datetime.now(timezone.utc)
                }
            ]
            
            if gd["name"] == "Goa Trip":
                for u in [friends_list[0], friends_list[1]]:
                    members_list.append({
                        "id": str(uuid.uuid4()),
                        "user_id": u.id,
                        "joined_at": datetime.now(timezone.utc)
                    })
            elif gd["name"] == "Flat Expenses":
                for u in [friends_list[1], friends_list[2], friends_list[3]]:
                    members_list.append({
                        "id": str(uuid.uuid4()),
                        "user_id": u.id,
                        "joined_at": datetime.now(timezone.utc)
                    })
            else:
                for u in [friends_list[0], friends_list[2], friends_list[3], friends_list[4]]:
                    members_list.append({
                        "id": str(uuid.uuid4()),
                        "user_id": u.id,
                        "joined_at": datetime.now(timezone.utc)
                    })
            
            await db["groups"].insert_one({
                "_id": g.id,
                "name": g.name,
                "description": g.description,
                "created_by": g.created_by,
                "created_at": g.created_at,
                "updated_at": g.updated_at,
                "members": members_list
            })
            g.members = [GroupMember(**m) for m in members_list]
        else:
            g = Group(**g_doc)
            g.members = [GroupMember(**m) for m in g_doc.get("members", [])]
        groups_list.append(g)

    # Create Budget for demo user
    now = datetime.now()
    b_doc = await db["budgets"].find_one({
        "user_id": demo.id,
        "month": now.month,
        "year": now.year
    })
    if not b_doc:
        b = Budget(
            user_id=demo.id,
            month=now.month,
            year=now.year,
            amount=20000.0
        )
        await db["budgets"].insert_one({
            "_id": b.id,
            "user_id": b.user_id,
            "month": b.month,
            "year": b.year,
            "amount": b.amount,
            "created_at": b.created_at,
            "updated_at": b.updated_at
        })

    # Add mock expenses
    expenses_data = [
        {
            "title": "Dinner at Raj's",
            "amount": 850.0,
            "category": "Food",
            "payment_method": "Cash",
            "paid_by": "demo",
            "split_type": "equal",
            "group_name": "Office Lunch",
            "participants": ["demo", "Rahul", "Arjun"]
        },
        {
            "title": "Goa Trip Tickets",
            "amount": 4200.0,
            "category": "Travel",
            "payment_method": "GPay",
            "paid_by": "Rahul",
            "split_type": "equal",
            "group_name": "Goa Trip",
            "participants": ["demo", "Rahul", "Safvan"]
        },
        {
            "title": "Groceries",
            "amount": 1500.0,
            "category": "Shopping",
            "payment_method": "Cash",
            "paid_by": "demo",
            "split_type": "equal",
            "group_name": "Flat Expenses",
            "participants": ["demo", "Safvan"]
        }
    ]

    for ed in expenses_data:
        existing_exp = await db["expenses"].find_one({"title": ed["title"]})
        if not existing_exp:
            g = next((g for g in groups_list if g.name == ed["group_name"]), None)
            group_id = g.id if g else None
            
            paid_by_id = demo.id if ed["paid_by"] == "demo" else next((u.id for u in friends_list if u.name == ed["paid_by"]), demo.id)
            
            exp = Expense(
                title=ed["title"],
                description="Automated demo expense",
                amount=ed["amount"],
                paid_by=paid_by_id,
                payment_method=ed["payment_method"],
                category=ed["category"],
                split_type=ed["split_type"],
                group_id=group_id,
                expense_date=datetime.now()
            )
            
            part_ids = []
            for p_name in ed["participants"]:
                if p_name == "demo":
                    part_ids.append(demo.id)
                else:
                    u_f = next((u for u in friends_list if u.name == p_name), None)
                    if u_f:
                        part_ids.append(u_f.id)
            
            share = ed["amount"] / len(part_ids)
            splits_list = []
            for pid in part_ids:
                splits_list.append({
                    "id": str(uuid.uuid4()),
                    "expense_id": exp.id,
                    "user_id": pid,
                    "share_amount": share,
                    "status": "accepted",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                })
            
            exp_date = exp.expense_date
            if isinstance(exp_date, date) and not isinstance(exp_date, datetime):
                exp_date = datetime.combine(exp_date, datetime.min.time())
                
            await db["expenses"].insert_one({
                "_id": exp.id,
                "title": exp.title,
                "description": exp.description,
                "amount": exp.amount,
                "paid_by": exp.paid_by,
                "payment_method": exp.payment_method,
                "category": exp.category,
                "split_type": exp.split_type,
                "group_id": exp.group_id,
                "expense_date": exp_date,
                "created_at": exp.created_at,
                "updated_at": exp.updated_at,
                "splits": splits_list
            })
            
    print("Demo data seeded successfully in MongoDB!")

if __name__ == "__main__":
    asyncio.run(seed())
