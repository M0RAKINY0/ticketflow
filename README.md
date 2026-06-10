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
