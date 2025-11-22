const express = require('express');
const router = express.Router();
const Raid = require('../../schemas/gameData/Raid');
const { requireAuthAndScope, validators } = require('../../config/validation');

// GET /api/raids - List all raids
router.get('/',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId };
      
      if (status) {
        query.status = status;
      }

      const raids = await Raid.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const count = await Raid.countDocuments(query);

      res.json({
        raids,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching raids:', error);
      res.status(500).json({ error: 'Failed to fetch raids' });
    }
  }
);

// GET /api/raids/:id - Get single raid
router.get('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const raid = await Raid.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!raid) {
        return res.status(404).json({ error: 'Raid not found' });
      }

      res.json(raid);
    } catch (error) {
      console.error('Error fetching raid:', error);
      res.status(500).json({ error: 'Failed to fetch raid' });
    }
  }
);

// POST /api/raids - Create raid report
router.post('/',
  requireAuthAndScope,
  validators.coordinates,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        raidName,
        location,
        targetFaction,
        attackingFaction,
        participants = [],
        loot = [],
        casualties = [],
        evidenceUrls = [],
        description,
        startTime,
        endTime,
        outcome
      } = req.body;

      if (!raidName || !location) {
        return res.status(400).json({ error: 'raidName and location required' });
      }

      const raid = new Raid({
        guildID: guildId,
        serviceId,
        raidName,
        location,
        targetFaction,
        attackingFaction,
        participants,
        loot,
        casualties,
        evidenceUrls,
        description,
        startTime: startTime || new Date(),
        endTime,
        outcome,
        status: endTime ? 'completed' : 'active'
      });

      await raid.save();
      res.status(201).json(raid);
    } catch (error) {
      console.error('Error creating raid:', error);
      res.status(500).json({ error: 'Failed to create raid' });
    }
  }
);

// PATCH /api/raids/:id - Update raid
router.patch('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        raidName,
        location,
        targetFaction,
        attackingFaction,
        participants,
        loot,
        casualties,
        evidenceUrls,
        description,
        startTime,
        endTime,
        outcome,
        status
      } = req.body;

      const updateData = {};
      if (raidName !== undefined) updateData.raidName = raidName;
      if (location !== undefined) updateData.location = location;
      if (targetFaction !== undefined) updateData.targetFaction = targetFaction;
      if (attackingFaction !== undefined) updateData.attackingFaction = attackingFaction;
      if (participants !== undefined) updateData.participants = participants;
      if (loot !== undefined) updateData.loot = loot;
      if (casualties !== undefined) updateData.casualties = casualties;
      if (evidenceUrls !== undefined) updateData.evidenceUrls = evidenceUrls;
      if (description !== undefined) updateData.description = description;
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      if (outcome !== undefined) updateData.outcome = outcome;
      if (status !== undefined) updateData.status = status;

      const raid = await Raid.findOneAndUpdate(
        { _id: req.params.id, guildID: guildId, serviceId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!raid) {
        return res.status(404).json({ error: 'Raid not found' });
      }

      res.json(raid);
    } catch (error) {
      console.error('Error updating raid:', error);
      res.status(500).json({ error: 'Failed to update raid' });
    }
  }
);

// POST /api/raids/:id/complete - Mark raid as completed
router.post('/:id/complete',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { outcome, loot, casualties } = req.body;

      const raid = await Raid.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!raid) {
        return res.status(404).json({ error: 'Raid not found' });
      }

      if (raid.status === 'completed') {
        return res.status(400).json({ error: 'Raid already completed' });
      }

      raid.status = 'completed';
      raid.endTime = new Date();
      if (outcome) raid.outcome = outcome;
      if (loot) raid.loot = loot;
      if (casualties) raid.casualties = casualties;

      await raid.save();
      res.json(raid);
    } catch (error) {
      console.error('Error completing raid:', error);
      res.status(500).json({ error: 'Failed to complete raid' });
    }
  }
);

// DELETE /api/raids/:id - Delete raid
router.delete('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      const raid = await Raid.findOneAndDelete({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!raid) {
        return res.status(404).json({ error: 'Raid not found' });
      }

      res.json({ message: 'Raid deleted successfully', raid });
    } catch (error) {
      console.error('Error deleting raid:', error);
      res.status(500).json({ error: 'Failed to delete raid' });
    }
  }
);

module.exports = router;
