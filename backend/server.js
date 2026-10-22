

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Attendee = require("./models/Attendee");
const Event = require("./models/Event");
const Ticket = require("./models/Ticket");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET;

app.use(cors());

// Log every request, including requests with invalid JSON.
function requestLogger(req, res, next) {
  console.log(
    `[${req.method}] [${req.path}] [${new Date().toISOString()}]`
  );
  next();
}

app.use(requestLogger);
app.use(express.json());

function authGuard(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Bearer token is required"
    });
  }

  try {
    req.user = jwt.verify(header.split(" ")[1], SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
}

// Public API: login
app.post("/api/v1/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const attendee = await Attendee.findOne({
      email: email.toLowerCase().trim()
    });

    if (
      !attendee ||
      !(await bcrypt.compare(password, attendee.password))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        id: attendee._id.toString(),
        email: attendee.email,
        name: attendee.name,
        role: attendee.role
      },
      SECRET,
      { expiresIn: "2h" }
    );

    res.status(200).json({
      success: true,
      token,
      role: attendee.role,
      attendee: {
        id: attendee._id,
        name: attendee.name,
        email: attendee.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// Public API: list events
app.get("/api/v1/events", async (req, res, next) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.status(200).json(events);
  } catch (error) {
    next(error);
  }
});

// Protected API: book tickets
app.post("/api/v1/tickets", authGuard, async (req, res, next) => {
  try {
    const { eventId, quantity } = req.body;

    if (
      !mongoose.isValidObjectId(eventId) ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid eventId and positive whole-number quantity"
      });
    }

    // Atomically reserve available tickets so stock cannot go negative.
    const event = await Event.findOneAndUpdate(
      {
        _id: eventId,
        ticketsAvailable: { $gte: quantity }
      },
      {
        $inc: { ticketsAvailable: -quantity }
      },
      { new: true, runValidators: true }
    );

    if (!event) {
      const exists = await Event.exists({ _id: eventId });

      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists
          ? "Not enough tickets available"
          : "Event not found"
      });
    }

    try {
      const ticket = await Ticket.create({
        attendeeId: req.user.id,
        eventId: event._id,
        quantity
      });

      return res.status(201).json({
        success: true,
        message: "Tickets booked successfully",
        ticket
      });
    } catch (error) {
      // Restore stock if the ticket document could not be saved.
      await Event.updateOne(
        { _id: event._id },
        { $inc: { ticketsAvailable: quantity } }
      );
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Protected API: only the logged-in attendee's tickets
app.get("/api/v1/tickets/my", authGuard, async (req, res, next) => {
  try {
    const tickets = await Ticket.find({
      attendeeId: req.user.id
    })
      .populate("attendeeId", "name email")
      .populate("eventId", "title date venue");

    res.status(200).json(tickets);
  } catch (error) {
    next(error);
  }
});

// Protected API: update ticket status
app.patch(
  "/api/v1/tickets/:id/status",
  authGuard,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket ID"
        });
      }

      if (!["cancelled", "used"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be cancelled or used"
        });
      }

      const ticket = await Ticket.findOne({
        _id: id,
        attendeeId: req.user.id
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found"
        });
      }

      if (ticket.status !== "booked") {
        return res.status(400).json({
          success: false,
          message: "Only booked tickets can be updated"
        });
      }

      if (status === "cancelled") {
        // Restore inventory only when cancellation is successful.
        const updated = await Ticket.findOneAndUpdate(
          { _id: id, attendeeId: req.user.id, status: "booked" },
          { $set: { status: "cancelled" } },
          { new: true, runValidators: true }
        );

        if (!updated) {
          return res.status(400).json({
            success: false,
            message: "Ticket status has already changed"
          });
        }

        await Event.updateOne(
          { _id: ticket.eventId },
          { $inc: { ticketsAvailable: ticket.quantity } }
        );

        return res.status(200).json({
          success: true,
          message: "Ticket cancelled",
          ticket: updated
        });
      }

      ticket.status = "used";
      await ticket.save();

      res.status(200).json({
        success: true,
        message: "Ticket marked as used",
        ticket
      });
    } catch (error) {
      next(error);
    }
  }
);

// Protected organizer summary, used by the existing React dashboard.
app.get(
  "/api/v1/organizer/summary",
  authGuard,
  async (req, res, next) => {
    try {
      if (req.user.role !== "organizer") {
        return res.status(403).json({
          success: false,
          message: "Organizer access required"
        });
      }

      const [totalEvents, totalBookings, events] = await Promise.all([
        Event.countDocuments(),
        Ticket.countDocuments({ status: "booked" }),
        Event.find().sort({ date: 1 })
      ]);

      res.status(200).json({ totalEvents, totalBookings, events });
    } catch (error) {
      next(error);
    }
  }
);

// Global error handler: must be the final middleware.
app.use((err, req, res, next) => {
  console.error(err.message);

  if (res.headersSent) {
    return next(err);
  }

  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid data",
      details: err.message
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: "A record with this unique value already exists"
    });
  }

  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body"
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// Start the API only after Atlas connects successfully.
async function startServer() {
  if (!SECRET) {
    throw new Error("JWT_SECRET is missing from backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas");

  app.listen(PORT, () => {
    console.log(`EventHub API running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start EventHub:", error.message);
  process.exit(1);
});
