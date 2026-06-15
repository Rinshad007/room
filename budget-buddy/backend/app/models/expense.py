import uuid
from datetime import datetime, date, timezone

class Expense:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.title = kwargs.get("title")
        self.description = kwargs.get("description")
        self.amount = float(kwargs.get("amount") or 0.0)
        self.paid_by = kwargs.get("paid_by")
        self.payment_method = kwargs.get("payment_method") or "Cash"
        self.category = kwargs.get("category") or "Others"
        self.split_type = kwargs.get("split_type") or "equal"
        self.group_id = kwargs.get("group_id")
        
        raw_date = kwargs.get("expense_date")
        if isinstance(raw_date, str):
            # Parse YYYY-MM-DD
            try:
                self.expense_date = date.fromisoformat(raw_date.split("T")[0])
            except ValueError:
                self.expense_date = date.today()
        elif isinstance(raw_date, datetime):
            self.expense_date = raw_date.date()
        elif isinstance(raw_date, date):
            self.expense_date = raw_date
        else:
            self.expense_date = date.today()
            
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
        self.splits = kwargs.get("splits") or [] # list of ExpenseSplit

class ExpenseSplit:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.expense_id = kwargs.get("expense_id")
        self.user_id = kwargs.get("user_id")
        self.share_amount = float(kwargs.get("share_amount") or 0.0)
        self.status = kwargs.get("status") or "pending"
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
