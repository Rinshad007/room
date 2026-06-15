import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ServerSelectionTimeoutError

async def test_conn():
    uri = "mongodb+srv://monurinu0_db_user:safvan@cluster45.uipvayp.mongodb.net/?appName=Cluster45"
    print("Connecting to:", uri)
    
    # Try standard client
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    try:
        print("Pinging...")
        # Ping the server
        await client.admin.command('ping')
        print("Ping successful!")
        return
    except Exception as e:
        print("Ping failed with standard options:", type(e), e)
        
    # Try with certifi if possible
    try:
        import certifi
        print("Found certifi at:", certifi.where())
        client_cert = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
        await client_cert.admin.command('ping')
        print("Ping successful with certifi!")
        return
    except Exception as e2:
        print("Ping failed with certifi options:", type(e2), e2)

    # Try with tlsAllowInvalidCertificates=True to see if it is just a certificate validation issue
    try:
        client_insecure = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
        await client_insecure.admin.command('ping')
        print("Ping successful with tlsAllowInvalidCertificates!")
        return
    except Exception as e3:
        print("Ping failed with tlsAllowInvalidCertificates:", type(e3), e3)

if __name__ == "__main__":
    asyncio.run(test_conn())
