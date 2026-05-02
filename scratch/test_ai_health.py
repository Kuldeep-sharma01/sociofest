import requests
import json

def test_health():
    try:
        response = requests.get("http://localhost:5001/health")
        print(f"Health Check: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Health Check Failed: {e}")

if __name__ == "__main__":
    test_health()
