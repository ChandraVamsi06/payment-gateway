# Payment Gateway Challenge

## Overview
A full-stack payment gateway simulation with Merchant Dashboard, Hosted Checkout, and API.

## Tech Stack
- **Backend:** Node.js (Express), PostgreSQL
- **Frontend:** React (Vite)
- **Checkout:** Vanilla JS
- **Infrastructure:** Docker & Docker Compose

## Setup Instructions
1. Ensure Docker is running.
2. Run the following command to start all services:
   ```bash
   docker-compose up -d --build
   ```
3. Access the services:
   - **Dashboard:** http://localhost:3000 (Login: test@example.com / password)
   - **API:** http://localhost:8000
   - **Checkout:** http://localhost:3001/checkout?order_id={id}