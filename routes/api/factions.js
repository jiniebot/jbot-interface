const express = require('express');
const router = express.Router();
const FactionProfile = require('../../schemas/userData/FactionProfile');
const { requireAuthAndScope, validators } = require('../../config/validation');

// GET /api/factions - List all factions
router.get('/',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId };
      
      // Search by name or tag
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { tag: { $regex: search, $options: 'i' } }
        ];
      }

      const factions = await FactionProfile.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const count = await FactionProfile.countDocuments(query);

      res.json({
        factions,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching factions:', error);
      res.status(500).json({ error: 'Failed to fetch factions' });
    }
  }
);

// GET /api/factions/:id - Get single faction
router.get('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const faction = await FactionProfile.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      }).populate('members.userId', 'username avatar');

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      res.json(faction);
    } catch (error) {
      console.error('Error fetching faction:', error);
      res.status(500).json({ error: 'Failed to fetch faction' });
    }
  }
);

// POST /api/factions - Create faction
router.post('/',
  requireAuthAndScope,
  validators.factionName,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        name,
        tag,
        description,
        color,
        icon,
        leader,
        memberCount = 1
      } = req.body;

      // Check if faction name or tag already exists
      const existing = await FactionProfile.findOne({
        guildID: guildId,
        serviceId,
        $or: [{ name }, { tag }]
      });

      if (existing) {
        return res.status(400).json({ 
          error: 'Faction with this name or tag already exists' 
        });
      }

      const faction = new FactionProfile({
        guildID: guildId,
        serviceId,
        name,
        tag,
        description,
        color,
        icon,
        leader,
        memberCount
      });

      await faction.save();
      res.status(201).json(faction);
    } catch (error) {
      console.error('Error creating faction:', error);
      res.status(500).json({ error: 'Failed to create faction' });
    }
  }
);

// PATCH /api/factions/:id - Update faction
router.patch('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        name,
        tag,
        description,
        color,
        icon,
        leader,
        memberCount,
        baseLocations,
        allies,
        enemies
      } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (tag !== undefined) updateData.tag = tag;
      if (description !== undefined) updateData.description = description;
      if (color !== undefined) updateData.color = color;
      if (icon !== undefined) updateData.icon = icon;
      if (leader !== undefined) updateData.leader = leader;
      if (memberCount !== undefined) updateData.memberCount = memberCount;
      if (baseLocations !== undefined) updateData.baseLocations = baseLocations;
      if (allies !== undefined) updateData.allies = allies;
      if (enemies !== undefined) updateData.enemies = enemies;

      const faction = await FactionProfile.findOneAndUpdate(
        { _id: req.params.id, guildID: guildId, serviceId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      res.json(faction);
    } catch (error) {
      console.error('Error updating faction:', error);
      res.status(500).json({ error: 'Failed to update faction' });
    }
  }
);

// POST /api/factions/:id/members - Add member to faction
router.post('/:id/members',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { userId, gamertag, role = 'member' } = req.body;

      if (!userId || !gamertag) {
        return res.status(400).json({ error: 'userId and gamertag required' });
      }

      const faction = await FactionProfile.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      // Check if member already exists
      const existingMember = faction.members.find(
        m => m.userId.toString() === userId
      );

      if (existingMember) {
        return res.status(400).json({ error: 'Member already in faction' });
      }

      faction.members.push({ userId, gamertag, role });
      faction.memberCount = faction.members.length;
      await faction.save();

      res.json(faction);
    } catch (error) {
      console.error('Error adding member:', error);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

// DELETE /api/factions/:id/members/:userId - Remove member from faction
router.delete('/:id/members/:userId',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;

      const faction = await FactionProfile.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      faction.members = faction.members.filter(
        m => m.userId.toString() !== req.params.userId
      );
      faction.memberCount = faction.members.length;
      await faction.save();

      res.json(faction);
    } catch (error) {
      console.error('Error removing member:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

// DELETE /api/factions/:id - Delete faction
router.delete('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      const faction = await FactionProfile.findOneAndDelete({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!faction) {
        return res.status(404).json({ error: 'Faction not found' });
      }

      res.json({ message: 'Faction deleted successfully', faction });
    } catch (error) {
      console.error('Error deleting faction:', error);
      res.status(500).json({ error: 'Failed to delete faction' });
    }
  }
);

module.exports = router;
