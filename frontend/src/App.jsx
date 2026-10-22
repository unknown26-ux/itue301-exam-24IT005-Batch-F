
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import "./App.css";

const API = "http://localhost:5000/api/v1";

function AppContent() {
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("eventhubUser")) || null;
    } catch {
      return null;
    }
  });
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [email, setEmail] = useState("attendee@example.com");
  const [password, setPassword] = useState("demo123");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadEvents() {
    try {
      const res = await fetch(`${API}/events`);
      if (!res.ok) throw new Error("Unable to load events");
      setEvents(await res.json());
    } catch {
      setMessage("Cannot connect to the backend. Start the server on port 5000.");
    }
  }

  async function loadTickets() {
    if (!user?.token) return;
    try {
      const res = await fetch(`${API}/tickets/my`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) setTickets(await res.json());
    } catch {
      setMessage("Unable to load your tickets.");
    }
  }

  useEffect(() => {
    loadEvents();
    loadTickets();
  }, [user?.token]);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      const savedUser = { ...data.attendee, token: data.token, role: data.role };
      localStorage.setItem("eventhubUser", JSON.stringify(savedUser));
      setUser(savedUser);
      setMessage("Login successful!");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function book(eventId) {
    if (!user) {
      setMessage("Please log in before booking tickets.");
      return;
    }
    const quantity = Number(prompt("How many tickets would you like?", "1"));
    if (!Number.isInteger(quantity) || quantity < 1) return;
    try {
      const res = await fetch(`${API}/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ eventId, quantity })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Booking failed");
      setMessage(data.message);
      await loadEvents();
      await loadTickets();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function cancelTicket(id) {
    try {
      const res = await fetch(`${API}/tickets/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ status: "cancelled" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Cancellation failed");
      setMessage(data.message);
      await loadEvents();
      await loadTickets();
    } catch (err) {
      setMessage(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("eventhubUser");
    setUser(null);
    setTickets([]);
    setMessage("You have logged out.");
  }

  return (
    <div className="app">
      <header className="navbar">
        <Link to="/" className="brand">EventHub</Link>
        <nav>
          <Link to="/">Events</Link>
          {user && <Link to="/tickets">My Tickets</Link>}
          {user?.role === "organizer" && <Link to="/organizer">Organizer</Link>}
          {user ? (
            <button onClick={logout}>Logout</button>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </nav>
      </header>

      {message && (
        <div className="message">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}

      <Routes>
        <Route path="/" element={
          <main className="container">
            <section className="hero">
              <p className="eyebrow">DISCOVER • BOOK • EXPERIENCE</p>
              <h1>Make memories.<br /><span>Find your next event.</span></h1>
              <p>Discover technology conferences, live music, and inspiring workshops.</p>
            </section>
            <h2>Upcoming Events</h2>
            
<h2>Upcoming Events</h2>

<input
  type="search"
  className="event-search"
  placeholder="Search events by title..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  aria-label="Search events by title"
/>

<div className="event-grid">
  {events
    .filter((event) =>
      event.title.toLowerCase().includes(search.toLowerCase())
    )
    .map((event) => (
      <EventCard
        key={event._id}
        event={event}
        onBook={book}
      />
    ))}
</div>

            <div className="event-grid">
              {events.map(event => (
                <article className="event-card" key={event._id}>
                  <div className="event-banner">{event.category}</div>
                  <div className="event-body">
                    <p className="event-date">{event.date}</p>
                    <h3>{event.title}</h3>
                    <p>📍 {event.venue}</p>
                    <p>{event.ticketsAvailable} tickets available</p>
                    <button onClick={() => book(event._id)}>Book Tickets</button>
                  </div>
                </article>
              ))}
              {events.length === 0 && <p>No events found. Check that the backend is running.</p>}
            </div>
          </main>
        } />

        <Route path="/login" element={
          user ? <Navigate to="/" /> :
          <main className="login-wrap">
            <form className="login-card" onSubmit={login}>
              <p className="eyebrow">WELCOME BACK</p>
              <h1>Sign in to EventHub</h1>
              <label>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
              <p className="hint">Demo: attendee@example.com / demo123</p>
            </form>
          </main>
        } />

        <Route path="/tickets" element={
          !user ? <Navigate to="/login" /> :
          <main className="container">
            <h1>My Tickets</h1>
            {tickets.length === 0 && <p>You have no bookings yet.</p>}
            <div className="event-grid">
              {tickets.map(ticket => (
                <article className="event-card event-body" key={ticket._id}>
                  <h3>{ticket.eventTitle}</h3>
                  <p>Quantity: {ticket.quantity}</p>
                  <p>Status: <strong>{ticket.status}</strong></p>
                  <p>Booked: {new Date(ticket.bookingDate).toLocaleString()}</p>
                  {ticket.status === "booked" &&
                    <button className="cancel" onClick={() => cancelTicket(ticket._id)}>Cancel Ticket</button>}
                </article>
              ))}
            </div>
          </main>
        } />

        <Route path="/organizer" element={
          !user ? <Navigate to="/login" /> :
          user.role !== "organizer" ? <Navigate to="/" /> :
          <Organizer token={user.token} />
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <footer>© 2026 EventHub · Your next great experience starts here.</footer>
    </div>
  );
}

function Organizer({ token }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/organizer/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Unable to load organizer summary");
        return res.json();
      })
      .then(setSummary)
      .catch(err => setError(err.message));
  }, [token]);

  return (
    <main className="container">
      <h1>Organizer Dashboard</h1>
      {error && <p>{error}</p>}
      {summary && <>
        <div className="stats">
          <div><h2>{summary.totalEvents}</h2><p>Total Events</p></div>
          <div><h2>{summary.totalBookings}</h2><p>Active Bookings</p></div>
        </div>
        {summary.events.map(event => <p key={event._id}>{event.title} — {event.ticketsAvailable} tickets left</p>)}
      </>}
    </main>
  );
}

function EventCard({ event, onBook }) {
  return (
    <article className="event-card">
      <div className="event-banner">{event.category}</div>

      <div className="event-body">
        <p className="event-date">
          {new Date(event.date).toLocaleDateString()}
        </p>

        <h3>{event.title}</h3>
        <p>📍 {event.venue}</p>
        <p>{event.ticketsAvailable} tickets available</p>

        <button
          disabled={event.ticketsAvailable < 1}
          onClick={() => onBook(event._id)}
        >
          {event.ticketsAvailable < 1 ? "Sold Out" : "Book Tickets"}
        </button>
      </div>
    </article>
  );
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}
