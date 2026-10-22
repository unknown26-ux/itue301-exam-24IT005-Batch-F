
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || "eventhub_dev_secret";

let events = [
  { _id: "1", title: "Tech Conference 2026", category: "Technology", date: "2026-11-15", venue: "Ahmedabad", ticketsAvailable: 100 },
  { _id: "2", title: "Music Night", category: "Music", date: "2026-11-20", venue: "Vadodara", ticketsAvailable: 50 },
  { _id: "3", title: "AI Workshop", category: "Education", date: "2026-11-25", venue: "Surat", ticketsAvailable: 30 }
];

let tickets = [];
let nextTicketId = 1;

function authGuard(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in first" });
  }

  try {
    req.user = jwt.verify(header.split(" ")[1], SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

app.get("/", (req, res) => {
  res.json({ message: "EventHub API is running" });
});

app.post("/api/v1/auth/login", (req, res) => {
  const { email, password } = req.body;

  const users = [
    { id: "u1", name: "Demo Attendee", email: "attendee@example.com", password: "demo123", role: "attendee" },
    { id: "u2", name: "Demo Organizer", email: "organizer@example.com", password: "demo123", role: "organizer" }
  ];

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    SECRET,
    { expiresIn: "2h" }
  );

  res.json({
    token,
    role: user.role,
    attendee: { id: user.id, name: user.name, email: user.email }
  });
});

app.get("/api/v1/events", (req, res) => {
  res.json(events);
});

app.post("/api/v1/tickets", authGuard, (req, res) => {
  const { eventId, quantity } = req.body;
  const amount = Number(quantity);

  if (!Number.isInteger(amount) || amount < 1) {
    return res.status(400).json({ message: "Quantity must be a positive integer" });
  }

  const event = events.find(e => e._id === String(eventId));

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (event.ticketsAvailable < amount) {
    return res.status(400).json({ message: "Not enough tickets available" });
  }

  event.ticketsAvailable -= amount;

  const ticket = {
    _id: String(nextTicketId++),
    attendeeId: req.user.id,
    attendeeName: req.user.name,
    eventId: event._id,
    eventTitle: event.title,
    quantity: amount,
    bookingDate: new Date().toISOString(),
    status: "booked"
  };

  tickets.push(ticket);
  res.status(201).json({ message: "Tickets booked successfully", ticket });
});

app.get("/api/v1/tickets/my", authGuard, (req, res) => {
  res.json(tickets.filter(t => t.attendeeId === req.user.id));
});

app.patch("/api/v1/tickets/:id/status", authGuard, (req, res) => {
  const ticket = tickets.find(t => t._id === req.params.id);

  if (!ticket || ticket.attendeeId !== req.user.id) {
    return res.status(404).json({ message: "Ticket not found" });
  }

  if (ticket.status !== "booked") {
    return res.status(400).json({ message: "Ticket is already cancelled or used" });
  }

  if (req.body.status !== "cancelled") {
    return res.status(400).json({ message: "Only cancellation is supported" });
  }

  ticket.status = "cancelled";
  const event = events.find(e => e._id === ticket.eventId);
  if (event) event.ticketsAvailable += ticket.quantity;

  res.json({ message: "Ticket cancelled", ticket });
});

app.get("/api/v1/organizer/summary", authGuard, (req, res) => {
  if (req.user.role !== "organizer") {
    return res.status(403).json({ message: "Organizer access required" });
  }

  res.json({
    totalEvents: events.length,
    totalBookings: tickets.filter(t => t.status === "booked").length,
    events
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`EventHub API running at http://localhost:${PORT}`);
});
