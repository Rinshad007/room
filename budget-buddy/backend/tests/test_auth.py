"""
Basic integration tests for the auth module.
Run with: pytest tests/ -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_and_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register
        register_resp = await client.post(
            "/api/v1/auth/register",
            json={"name": "Test User", "email": "test@example.com", "password": "Test1234"},
        )
        assert register_resp.status_code in (201, 409), register_resp.text
        
        if register_resp.status_code == 201:
            data = register_resp.json()
            assert "access_token" in data
            assert "refresh_token" in data

        # Login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "Test1234"},
        )
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        assert "access_token" in login_data


@pytest.mark.asyncio
async def test_login_wrong_password():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "WrongPass999"},
        )
        assert resp.status_code == 401
