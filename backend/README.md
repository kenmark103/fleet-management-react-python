\# Fleet Management System — Backend



FastAPI backend for the Fleet Management System. Handles authentication, fleet operations, notifications, and email services.



---



\## Tech Stack



\- \*\*Framework\*\*: FastAPI

\- \*\*Database\*\*: PostgreSQL (async via asyncpg + SQLAlchemy)

\- \*\*Migrations\*\*: Alembic

\- \*\*Auth\*\*: JWT (access + refresh tokens), Google OAuth

\- \*\*Email\*\*: aiosmtplib

\- \*\*Testing\*\*: pytest + pytest-asyncio

\- \*\*Runtime\*\*: Python 3.11



---



\## Project Structure



```

backend/

├── alembic/                    # Database migrations

│   ├── versions/               # Migration files

│   └── env.py

├── auth/                       # Authentication

│   ├── route\_auth.py           # Auth endpoints (login, logout, refresh, OAuth)

│   └── security.py             # Password hashing, token logic

├── core/                       # App-wide config

│   └── config.py               # Pydantic settings (loads from env file)

├── db/                         # Database setup

│   ├── dbconfig.py             # Engine, session factory

│   └── models.py               # SQLAlchemy models

├── routes/                     # Feature routes

│   ├── settings/               # User/system settings endpoints

│   └── \*.py                    # Fleet, notifications, etc.

├── schemas/                    # Pydantic request/response schemas

├── services/                   # Business logic layer

├── scripts/                    # Utility scripts

├── static/                     # Static file serving

│   └── avatars/                # User avatar uploads

├── templates/                  # Email HTML templates

├── tests/                      # Test suite

│   ├── integration/            # Integration tests

│   └── performance/            # Performance tests

├── worker/                     # Background task workers

├── .env.example                # Environment variable template

├── .env.local                  # Local dev env (git ignored)

├── .env.docker                 # Docker env (git ignored)

├── .dockerignore

├── Dockerfile

├── alembic.ini

├── main.py                     # App entrypoint, lifespan, router registration

├── requirements.txt

└── seeddb.py                   # Database seeding script

```



---



\## Getting Started



\### Prerequisites

\- Python 3.11+

\- PostgreSQL running locally or via Docker



\### Local Setup



```bash

\# 1. Clone the repo

git clone https://github.com/yourname/fms.git

cd fms/backend



\# 2. Create and activate virtual environment

python -m venv venv

venv\\Scripts\\activate        # Windows

source venv/bin/activate     # Mac/Linux



\# 3. Install dependencies

pip install -r requirements.txt



\# 4. Set up environment

cp .env.example .env.local

\# Edit .env.local and fill in your values



\# 5. Run migrations

alembic upgrade head



\# 6. Seed the database

python seeddb.py



\# 7. Start the server

python main.py

```



Server runs at: `http://localhost:8000`

API docs at: `http://localhost:8000/docs`



---



\## Running with Docker



```bash

\# From the project root (fms/)

docker-compose up --build



\# Run migrations inside the container

docker exec -it fastapi\_app alembic upgrade head



\# Seed the database

docker exec -it fastapi\_app python seeddb.py

```



---



\## Environment Variables



Copy `.env.example` to `.env.local` (for local dev) or `.env.docker` (for Docker).



The app selects the correct env file based on the `APP\_ENV` environment variable:



| APP\_ENV value | Env file loaded |

|---|---|

| `local` (default) | `.env.local` |

| `docker` | `.env.docker` |

| `production` | `.env.production` |



Docker sets `APP\_ENV=docker` automatically via `docker-compose.yml`. Locally it defaults to `local` with no setup needed.



---



\## Database Migrations



```bash

\# Apply all migrations

alembic upgrade head



\# Create a new migration after model changes

alembic revision --autogenerate -m "describe your change"



\# Roll back one migration

alembic downgrade -1

```



---



\## Running Tests



```bash

pytest                        # Run all tests

pytest tests/integration/     # Run integration tests only

pytest --cov=. --cov-report=html  # Run with coverage report

```

