"""
Manual login smoke check for a locally running backend.

This file is intentionally executable as a script, and has no import-time side effects
so it won't break automated pytest runs.
"""

import requests


def main() -> None:
    response = requests.post(
        "http://localhost:8000/api/auth/login",
        json={"email": "user1@company.com", "password": "password123"},
        timeout=5,
    )
    response.raise_for_status()
    print(response.json())


if __name__ == "__main__":
    main()
