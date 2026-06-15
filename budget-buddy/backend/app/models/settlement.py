import uuid
from datetime import datetime, timezone

class Settlement:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.payer_id = kwargs.get("payer_id")
        self.receiver_id = kwargs.get("receiver_id")
        self.amount = float(kwargs.get("amount") or 0.0)
        self.payment_method = kwargs.get("payment_method") or "Cash"
        self.status = kwargs.get("status") or "pending"
        self.settled_at = kwargs.get("settled_at")
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
