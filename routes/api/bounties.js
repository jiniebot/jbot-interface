const express = require("express");
const router = express.Router();
const Bounty = require("../../schemas/gameData/Bounty");
const {
  requireAuthAndScope,
  validators,
  handleValidationErrors,
} = require("../../config/validation");

// Get all bounties for current guild/service
router.get("/", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const { status, targetUserId } = req.query;

    const query = { guildID: guildId, serviceId: serviceId };
    
    if (status) query.status = status;
    if (targetUserId) query.targetUserId = targetUserId;

    const bounties = await Bounty.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ bounties });
  } catch (err) {
    console.error("❌ Error fetching bounties:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get specific bounty
router.get("/:id", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const bounty = await Bounty.findOne({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!bounty) {
      return res.status(404).json({ error: "Bounty not found" });
    }

    res.json({ bounty });
  } catch (err) {
    console.error("❌ Error fetching bounty:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new bounty
router.post("/", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const { targetUserId, targetGamertag, reward, description, duration } = req.body;

    const bounty = new Bounty({
      guildID: guildId,
      serviceId: serviceId,
      targetUserId,
      targetGamertag,
      reward,
      description,
      createdBy: req.user.id,
      expiresAt: new Date(Date.now() + (duration || 24) * 60 * 60 * 1000), // Default 24 hours
    });

    await bounty.save();
    res.status(201).json({ bounty });
  } catch (err) {
    console.error("❌ Error creating bounty:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update bounty
router.patch("/:id", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const { reward, description, status, lastKnownLocation } = req.body;

    const bounty = await Bounty.findOne({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!bounty) {
      return res.status(404).json({ error: "Bounty not found" });
    }

    if (reward !== undefined) bounty.reward = reward;
    if (description !== undefined) bounty.description = description;
    if (status !== undefined) bounty.status = status;
    if (lastKnownLocation !== undefined) bounty.lastKnownLocation = lastKnownLocation;

    await bounty.save();
    res.json({ bounty });
  } catch (err) {
    console.error("❌ Error updating bounty:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Claim bounty
router.post("/:id/claim", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const { evidence } = req.body;

    const bounty = await Bounty.findOne({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!bounty) {
      return res.status(404).json({ error: "Bounty not found" });
    }

    if (bounty.status !== "active") {
      return res.status(400).json({ error: "Bounty is not active" });
    }

    bounty.claimedBy = req.user.id;
    bounty.claimedAt = new Date();
    bounty.status = "claimed";
    if (evidence) bounty.evidence = evidence;

    await bounty.save();
    res.json({ bounty });
  } catch (err) {
    console.error("❌ Error claiming bounty:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete bounty
router.delete("/:id", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    
    const bounty = await Bounty.findOneAndDelete({
      _id: req.params.id,
      guildID: guildId,
      serviceId: serviceId,
    });

    if (!bounty) {
      return res.status(404).json({ error: "Bounty not found" });
    }

    res.json({ message: "Bounty deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting bounty:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
