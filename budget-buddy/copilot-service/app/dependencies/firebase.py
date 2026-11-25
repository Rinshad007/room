import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import firebase_admin
from firebase_admin import credentials, db

_firebase_initialized = False

DEFAULT_RTDB_URL = os.environ.get(
    "FIREBASE_DATABASE_URL",
    "https://buddybuddy-23085-default-rtdb.firebaseio.com"
)


def init_firebase():
    """Initialize Firebase Admin SDK with credentials from env or local file."""
    global _firebase_initialized
    if _firebase_initialized:
        return

    # Check if default app already exists
    try:
        firebase_admin.get_app()
        _firebase_initialized = True
        return
    except ValueError:
        pass

    cred = None

    # 1. Raw JSON string in environment variable
    json_env = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if json_env:
        try:
            cert_dict = json.loads(json_env)
            cred = credentials.Certificate(cert_dict)
        except Exception as e:
            print(f"[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")

    # 2. Path in environment variable (e.g. GOOGLE_APPLICATION_CREDENTIALS)
    if not cred:
        path_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.environ.get("FIREBASE_CREDENTIALS_PATH")
        if path_env and os.path.exists(path_env):
            try:
                cred = credentials.Certificate(path_env)
            except Exception as e:
                print(f"[Firebase] Failed to load credentials from {path_env}: {e}")

    # 3. Local file in copilot-service
    if not cred:
        local_path = os.path.join(os.path.dirname(__file__), "..", "..", "firebase-service-account.json")
        if os.path.exists(local_path):
            try:
                cred = credentials.Certificate(local_path)
            except Exception as e:
                print(f"[Firebase] Failed to load {local_path}: {e}")

    # 4. Known frontend service account file
    if not cred:
        frontend_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "frontend",
            "buddybuddy-23085-firebase-adminsdk-fbsvc-ed621b9e14.json"
        )
        if os.path.exists(frontend_path):
            try:
                cred = credentials.Certificate(frontend_path)
            except Exception as e:
                print(f"[Firebase] Failed to load {frontend_path}: {e}")

    if not cred:
        print("[Firebase] Warning: No service account credentials found. Attempting default credentials.")
        try:
            cred = credentials.ApplicationDefault()
        except Exception:
            pass

    if cred:
        firebase_admin.initialize_app(cred, {"databaseURL": DEFAULT_RTDB_URL})
    else:
        firebase_admin.initialize_app(options={"databaseURL": DEFAULT_RTDB_URL})

    _firebase_initialized = True
    print("[Firebase] Connected to Realtime Database:", DEFAULT_RTDB_URL)


# Auto-initialize on import
init_firebase()


def get_expenses_ref():
    """Get reference to the /expenses RTDB node."""
    init_firebase()
    return db.reference("expenses")


def get_user_expenses(user_id: str) -> List[Dict[str, Any]]:
    """Fetch all expenses belonging to or split with the given user_id."""
    ref = get_expenses_ref()
    snapshot = ref.get()
    if not snapshot:
        return []

    user_expenses = []
    for exp_id, exp_data in snapshot.items():
        if not isinstance(exp_data, dict):
            continue

        # Match paid_by or participant in splits
        paid_by = str(exp_data.get("paid_by") or "")
        splits = exp_data.get("splits") or []
        user_in_splits = any(
            str(s.get("user_id") or "") == str(user_id)
            for s in splits
            if isinstance(s, dict)
        )

        if paid_by == str(user_id) or user_in_splits:
            exp_copy = dict(exp_data)
            exp_copy["id"] = exp_copy.get("id") or exp_id
            user_expenses.append(exp_copy)

    # Sort descending by expense_date or created_at
    user_expenses.sort(
        key=lambda x: str(x.get("expense_date") or x.get("created_at") or ""),
        reverse=True,
    )
    return user_expenses


def create_user_expense(
    user_id: str,
    title: str,
    amount: float,
    category: str = "Other",
    payment_method: str = "cash",
    description: str = "",
) -> Dict[str, Any]:
    """Create a new expense in Firebase RTDB matching Budget Buddy's schema."""
    ref = get_expenses_ref()
    new_ref = ref.push()
    expense_id = new_ref.key

    now_iso = datetime.now(timezone.utc).isoformat()
    amount_clean = round(float(amount), 2)

    expense_data = {
        "id": expense_id,
        "title": title.strip(),
        "description": description.strip(),
        "amount": amount_clean,
        "paid_by": str(user_id),
        "payment_method": payment_method,
        "category": category.strip().capitalize(),
        "split_type": "equal",
        "expense_date": now_iso,
        "created_at": now_iso,
        "splits": [
            {
                "id": f"{expense_id}_split_0",
                "user_id": str(user_id),
                "share_amount": amount_clean,
                "status": "accepted",
            }
        ],
    }

    new_ref.set(expense_data)
    return expense_data


def update_user_expense(
    user_id: str,
    expense_id: str,
    updates: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Update an existing expense in Firebase RTDB if owned by user_id."""
    ref = get_expenses_ref().child(expense_id)
    snapshot = ref.get()
    if not snapshot or not isinstance(snapshot, dict):
        return None

    if str(snapshot.get("paid_by") or "") != str(user_id):
        return None

    allowed_updates = {}
    if "title" in updates:
        allowed_updates["title"] = updates["title"].strip()
    if "amount" in updates:
        amount_clean = round(float(updates["amount"]), 2)
        allowed_updates["amount"] = amount_clean
        # Also update the single split share amount if it was self-paid
        splits = snapshot.get("splits") or []
        if len(splits) == 1 and splits[0].get("user_id") == str(user_id):
            splits[0]["share_amount"] = amount_clean
            allowed_updates["splits"] = splits
    if "category" in updates:
        allowed_updates["category"] = updates["category"].strip().capitalize()
    if "description" in updates:
        allowed_updates["description"] = updates["description"].strip()

    if allowed_updates:
        ref.update(allowed_updates)
        snapshot.update(allowed_updates)

    return snapshot


def delete_user_expense(user_id: str, expense_id: str) -> bool:
    """Delete an expense from Firebase RTDB if owned by user_id."""
    ref = get_expenses_ref().child(expense_id)
    snapshot = ref.get()
    if not snapshot or not isinstance(snapshot, dict):
        return False

    if str(snapshot.get("paid_by") or "") != str(user_id):
        return False

    ref.delete()
    return True


# ─── Chat Message Storage in Firebase ─────────────────────────────────────────

def get_messages_ref(user_id: str):
    """Reference to /copilot_messages/{user_id}."""
    init_firebase()
    return db.reference(f"copilot_messages/{user_id}")


def save_chat_message(user_id: str, role: str, content: str) -> Dict[str, Any]:
    """Store copilot chat message in Firebase RTDB."""
    ref = get_messages_ref(user_id)
    new_msg_ref = ref.push()
    now_iso = datetime.now(timezone.utc).isoformat()
    msg_data = {
        "id": new_msg_ref.key,
        "user_id": str(user_id),
        "role": role,
        "content": content,
        "timestamp": now_iso,
    }
    new_msg_ref.set(msg_data)
    return msg_data


def fetch_chat_messages(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve chat history from Firebase RTDB."""
    ref = get_messages_ref(user_id)
    snapshot = ref.get()
    if not snapshot or not isinstance(snapshot, dict):
        return []

    messages = []
    for msg_id, data in snapshot.items():
        if isinstance(data, dict):
            messages.append({
                "id": data.get("id") or msg_id,
                "role": data.get("role", "user"),
                "content": data.get("content", ""),
                "timestamp": data.get("timestamp"),
            })

    # Sort ascending by timestamp
    messages.sort(key=lambda m: str(m.get("timestamp") or ""))
    return messages[-limit:]


def clear_chat_messages(user_id: str):
    """Delete all chat messages for user from Firebase RTDB."""
    ref = get_messages_ref(user_id)
    ref.delete()
