import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_dashboard_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register user 1
        reg1_resp = await client.post(
            "/api/v1/auth/register",
            json={"name": "Alice", "email": "alice@example.com", "password": "Password123"},
        )
        assert reg1_resp.status_code in (201, 409)
        
        # Register user 2
        reg2_resp = await client.post(
            "/api/v1/auth/register",
            json={"name": "Bob", "email": "bob@example.com", "password": "Password123"},
        )
        assert reg2_resp.status_code in (201, 409)

        # Login as Alice
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice@example.com", "password": "Password123"},
        )
        assert login_resp.status_code == 200
        alice_token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {alice_token}"}

        # Get Bob's info by searching
        search_resp = await client.get("/api/v1/users/search?q=bob@example.com", headers=headers)
        assert search_resp.status_code == 200
        bob_id = search_resp.json()["users"][0]["id"]

        # Send friend request Alice -> Bob
        req_resp = await client.post(
            "/api/v1/friends/request",
            json={"receiver_id": bob_id},
            headers=headers,
        )
        assert req_resp.status_code == 201
        friendship_id = req_resp.json()["id"]

        # Login as Bob to see pending request
        login_bob_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "bob@example.com", "password": "Password123"},
        )
        bob_token = login_bob_resp.json()["access_token"]
        bob_headers = {"Authorization": f"Bearer {bob_token}"}

        # Check Bob's pending requests (Alice's request should be in received)
        bob_pending_resp = await client.get("/api/v1/friends/pending", headers=bob_headers)
        assert bob_pending_resp.status_code == 200
        bob_pending_data = bob_pending_resp.json()
        assert len(bob_pending_data["received"]) == 1
        assert bob_pending_data["received"][0]["friendship_id"] == friendship_id
        assert bob_pending_data["received"][0]["friend"]["name"] == "Alice"

        # Accept request
        accept_resp = await client.post(
            f"/api/v1/friends/{friendship_id}/accept",
            headers=bob_headers,
        )
        assert accept_resp.status_code == 200

        # Add expense from Alice
        exp_resp = await client.post(
            "/api/v1/expenses/",
            json={
                "title": "Pizza Party",
                "amount": 1000.0,
                "category": "Food",
                "payment_method": "Cash",
                "split_type": "equal",
                "expense_date": "2026-06-15",
                "participants": [bob_id],
            },
            headers=headers,
        )
        assert exp_resp.status_code == 201

        # Check dashboard summary for Alice
        dash_resp = await client.get("/api/v1/analytics/dashboard", headers=headers)
        assert dash_resp.status_code == 200
        dash_data = dash_resp.json()
        assert "total_expenses" in dash_data
        assert "total_spent" in dash_data
        assert "net_balance" in dash_data

        # Check list expenses for Alice
        exp_list_resp = await client.get("/api/v1/expenses/", headers=headers)
        assert exp_list_resp.status_code == 200
        exp_list_data = exp_list_resp.json()
        assert "expenses" in exp_list_data
        assert len(exp_list_data["expenses"]) == 1

        # Check pending requests for Alice (should be empty but not crash)
        pending_resp = await client.get("/api/v1/friends/pending", headers=headers)
        assert pending_resp.status_code == 200
