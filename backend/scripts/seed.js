
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Attendee = require("../models/Attendee");
const Event = require("../models/Event");

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const password = await bcrypt.hash("demo123", 10);

  const users = [
    {
      name: "Demo Attendee",
      email: "attendee@example.com",
      password,
      role: "attendee"
    },
    {
      name: "Demo Organizer",
      email: "organizer@example.com",
      password,
      role: "organizer"
    }
  ];

  for (const user of users) {
    await Attendee.updateOne(
      { email: user.email },
      { $setOnInsert: user },
      { upsert: true }
    );
  }

  const events = [
    {
      title: "Tech Conference 2026",
      category: "Technology",
      date: new Date("2026-11-15"),
      venue: "Ahmedabad",
      ticketsAvailable: 100
    },
    {
      title: "Music Night",
      category: "Music",
      date: new Date("2026-11-20"),
      venue: "Vadodara",
      ticketsAvailable: 50
    },
    {
      title: "AI Workshop",
      category: "Education",
      date: new Date("2026-11-25"),
      venue: "Surat",
      ticketsAvailable: 30
    }
  ];

  for (const event of events) {
    await Event.updateOne(
      { title: event.title },
      { $setOnInsert: event },
      { upsert: true }
    );
  }

  console.log("Demo users and events are ready.");
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
