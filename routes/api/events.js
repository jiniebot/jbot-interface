const express = require("express");
const router = express.Router();
const DynamicEvent = require("../../schemas/gameData/DynamicEvent");
const {
  requireAuthAndScope,
} = require("../../config/validation");

// Get all events for current guild/service
router.get("/", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const { status, eventType, isActive } = req.query;

    const query = { guildID: guildId, serviceId: serviceId };
    
    if (status) query.status = status;
    if (eventType) query.eventType = eventType;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const events = await DynamicEvent.find(query)
      .sort({ startTime: -1 })
      .limit(100);

    res.json({ events });
  } catch (err) {
    console.error("❌ Error fetching events:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get specific event
router.get("/:id", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const event = await DynamicEvent.findOne({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ event });
  } catch (err) {
    console.error("❌ Error fetching event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new event
router.post("/", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const {
      eventType,
      name,
      description,
      location,
      radius,
      startTime,
      duration,
      rewards,
      settings,
    } = req.body;

    const event = new DynamicEvent({
      guildID: guildId,
      serviceId: serviceId,
      eventType,
      name,
      description,
      location,
      radius,
      startTime: startTime || new Date(),
      duration,
      rewards,
      settings,
    });

    await event.save();
    res.status(201).json({ event });
  } catch (err) {
    console.error("❌ Error creating event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start event
router.post("/:id/start", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    
    const event = await DynamicEvent.findOne({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    await event.start();
    res.json({ event });
  } catch (err) {
    console.error("❌ Error starting event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// End event
router.post("/:id/end", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    
    const event = await DynamicEvent.findOne({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    await event.end();
    res.json({ event });
  } catch (err) {
    console.error("❌ Error ending event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Join event
router.post("/:id/join", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const { gamertag } = req.body;
    
    const event = await DynamicEvent.findOne({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    await event.addParticipant(req.user.id, gamertag);
    res.json({ event });
  } catch (err) {
    console.error("❌ Error joining event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update event
router.patch("/:id", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const updates = req.body;

    const event = await DynamicEvent.findOneAndUpdate(
      {
        _id: req.params.id,
        guildID: guildId,
        serviceId: serviceId,
      },
      updates,
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ event });
  } catch (err) {
    console.error("❌ Error updating event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete event
router.delete("/:id", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    
    const event = await DynamicEvent.findOneAndDelete({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting event:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
