import asyncio
import uuid
from datetime import datetime, date, timezone
from sqlalchemy import select, or_, and_
from app.db.session import AsyncSessionLocal, async_engine, Base
from app.core.security import get_password_hash
from app.models.user import User
from app.models.friendship import Friendship
from app.models.group import Group, GroupMember
from app.models.expense import Expense, ExpenseSplit
from app.models.budget import Budget

async def seed():
    # Ensure tables are created first
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if demo user exists
        stmt = select(User).where(User.email == "demo@budgetbuddy.app")
        result = await session.execute(stmt)
        demo = result.scalars().first()
        
        if not demo:
            demo = User(
                name="Demo User",
                email="demo@budgetbuddy.app",
                password_hash=get_password_hash("Demo1234")
            )
            session.add(demo)
            await session.commit()
        
        # Create demo friends
        friends_data = [
            {"name": "Rahul", "email": "rahul@budgetbuddy.app"},
            {"name": "Safvan", "email": "safvan@budgetbuddy.app"},
            {"name": "Arjun", "email": "arjun@budgetbuddy.app"},
            {"name": "Meera", "email": "meera@budgetbuddy.app"},
            {"name": "Priya", "email": "priya@budgetbuddy.app"}
        ]
        
        friends_list = []
        for fd in friends_data:
            stmt_f = select(User).where(User.email == fd["email"])
            res_f = await session.execute(stmt_f)
            u = res_f.scalars().first()
            if not u:
                u = User(
                    name=fd["name"],
                    email=fd["email"],
                    password_hash=get_password_hash("Friend1234")
                )
                session.add(u)
                await session.commit()
            friends_list.append(u)

        # Refresh friends list and demo from database to associate correctly
        for f in friends_list:
            stmt_fr = select(Friendship).where(
                or_(
                    and_(Friendship.sender_id == demo.id, Friendship.receiver_id == f.id),
                    and_(Friendship.sender_id == f.id, Friendship.receiver_id == demo.id)
                )
            )
            res_fr = await session.execute(stmt_fr)
            existing = res_fr.scalars().first()
            if not existing:
                friendship = Friendship(
                    sender_id=demo.id,
                    receiver_id=f.id,
                    status="accepted"
                )
                session.add(friendship)
                await session.commit()

        # Create Groups
        groups_data = [
            {"name": "Goa Trip", "desc": "Trip to Goa with friends"},
            {"name": "Flat Expenses", "desc": "Shared apartment bills"},
            {"name": "Office Lunch", "desc": "Lunch splits at work"}
        ]

        groups_list = []
        for gd in groups_data:
            stmt_g = select(Group).where(Group.name == gd["name"])
            res_g = await session.execute(stmt_g)
            g = res_g.scalars().first()
            if not g:
                g = Group(
                    name=gd["name"],
                    description=gd["desc"],
                    created_by=demo.id
                )
                session.add(g)
                await session.commit()
                
                # Add members
                members_list = [GroupMember(group_id=g.id, user_id=demo.id)]
                if gd["name"] == "Goa Trip":
                    for u in [friends_list[0], friends_list[1]]:
                        members_list.append(GroupMember(group_id=g.id, user_id=u.id))
                elif gd["name"] == "Flat Expenses":
                    for u in [friends_list[1], friends_list[2], friends_list[3]]:
                        members_list.append(GroupMember(group_id=g.id, user_id=u.id))
                else:
                    for u in [friends_list[0], friends_list[2], friends_list[3], friends_list[4]]:
                        members_list.append(GroupMember(group_id=g.id, user_id=u.id))
                
                for m in members_list:
                    session.add(m)
                await session.commit()
                
                # Fetch refreshed group with members loaded
                stmt_gr = select(Group).where(Group.id == g.id)
                res_gr = await session.execute(stmt_gr)
                g = res_gr.scalars().first()
            groups_list.append(g)

        # Create Budget
        now = datetime.now()
        stmt_b = select(Budget).where(
            Budget.user_id == demo.id,
            Budget.month == now.month,
            Budget.year == now.year
        )
        res_b = await session.execute(stmt_b)
        b = res_b.scalars().first()
        if not b:
            b = Budget(
                user_id=demo.id,
                month=now.month,
                year=now.year,
                amount=20000.0
            )
            session.add(b)
            await session.commit()

        # Add mock expenses
        expenses_data = [
            {
                "title": "Dinner at Raj's",
                "amount": 850.0,
                "category": "Food",
                "payment_method": "Cash",
                "paid_by": "demo",
                "group_name": "Office Lunch",
                "participants": ["demo", "Rahul", "Arjun"]
            },
            {
                "title": "Goa Trip Tickets",
                "amount": 4200.0,
                "category": "Travel",
                "payment_method": "GPay",
                "paid_by": "Rahul",
                "group_name": "Goa Trip",
                "participants": ["demo", "Rahul", "Safvan"]
            },
            {
                "title": "Groceries",
                "amount": 1500.0,
                "category": "Shopping",
                "payment_method": "Cash",
                "paid_by": "demo",
                "group_name": "Flat Expenses",
                "participants": ["demo", "Safvan"]
            }
        ]

        for ed in expenses_data:
            stmt_e = select(Expense).where(Expense.title == ed["title"])
            res_e = await session.execute(stmt_e)
            existing_exp = res_e.scalars().first()
            
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
                    split_type="equal",
                    group_id=group_id,
                    expense_date=date.today()
                )
                session.add(exp)
                await session.commit()
                
                part_ids = []
                for p_name in ed["participants"]:
                    if p_name == "demo":
                        part_ids.append(demo.id)
                    else:
                        u_f = next((u for u in friends_list if u.name == p_name), None)
                        if u_f:
                            part_ids.append(u_f.id)
                
                share = ed["amount"] / len(part_ids)
                for pid in part_ids:
                    split = ExpenseSplit(
                        expense_id=exp.id,
                        user_id=pid,
                        share_amount=share,
                        status="accepted"
                    )
                    session.add(split)
                await session.commit()

        print("Demo data seeded successfully in PostgreSQL!")

if __name__ == "__main__":
    asyncio.run(seed())
