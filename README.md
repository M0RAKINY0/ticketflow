# ticketflow

ticketflow is a production-inspired event ticketing backend built with Node.js, Express, TypeScript, PostgreSQL, Redis, and Docker. It enables organizers to create and manage events while allowing attendees to reserve tickets, receive QR-coded digital passes, and check in seamlessly at event venues.

The project is designed to go beyond basic CRUD operations and explore backend engineering concepts commonly used in real-world systems. It implements authentication and role-based access control, ticket inventory management, QR code generation, Redis caching, rate limiting, background job processing, and transactional database operations to ensure reliability and consistency.

Organizers can create events, define ticket categories, monitor ticket availability, and validate attendees during check-in. Each ticket is assigned a unique identifier and QR code, enabling fast and secure verification at the point of entry. To prevent overselling, ticket reservations are processed using database transactions, ensuring inventory remains accurate even under concurrent requests.

Ventra follows a layered architecture consisting of controllers, services, repositories, and middleware, promoting maintainability and scalability. Redis is used for caching frequently accessed data, managing rate limits, and powering asynchronous jobs through BullMQ. The application is fully containerized with Docker and can be deployed behind Nginx for load balancing and horizontal scaling.

## Key Features

* JWT-based authentication and authorization
* Role-based access control (User, Organizer, Admin)
* Event and ticket type management
* Ticket reservation with transactional inventory updates
* Unique ticket generation and QR code creation
* Event check-in and ticket validation
* Redis-powered caching
* API rate limiting
* Background job processing with BullMQ
* Request logging and centralized error handling
* Dockerized development and deployment environment
* Scalable architecture with Nginx load balancing support

## Authentication API

The current API exposes authentication under `/api/v1/auth`. Public registration always creates a `USER` account, even if the request includes another role. `POST /register`, `POST /login`, and `POST /refresh` return a short-lived access JWT and an opaque refresh token. Refresh tokens are generated from 48 random bytes, stored only as SHA-256 hashes, expire after 30 days, and are invalidated when rotated or logged out.

Use the access token as `Authorization: Bearer <token>` for `GET /api/v1/me`. Only `ADMIN` accounts may call `PATCH /api/v1/users/:userId/role`, and that endpoint may assign only `USER` or `ORGANIZER`; it cannot create another administrator through the API.

## Tech Stack

* Node.js
* Express.js
* TypeScript
* PostgreSQL
* Redis
* BullMQ
* Docker
* Nginx
* JWT Authentication

Ventra serves as a practical backend engineering project focused on building scalable, maintainable, and production-ready REST APIs while exploring modern backend infrastructure and system design patterns.
