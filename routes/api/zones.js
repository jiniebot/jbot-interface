const express = require('express');
const router = express.Router();
const MonitorZone = require('../../schemas/gameData/MonitorZone');
const { requireAuthAndScope, validators } = require('../../config/validation');

// GET /api/zones - List all zones
router.get('/',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 50, type } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId };
      
      if (type) {
        query.type = type;
      }

      const zones = await MonitorZone.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const count = await MonitorZone.countDocuments(query);

      res.json({
        zones,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching zones:', error);
      res.status(500).json({ error: 'Failed to fetch zones' });
    }
  }
);

// GET /api/zones/:id - Get single zone
router.get('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const zone = await MonitorZone.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!zone) {
        return res.status(404).json({ error: 'Zone not found' });
      }

      res.json(zone);
    } catch (error) {
      console.error('Error fetching zone:', error);
      res.status(500).json({ error: 'Failed to fetch zone' });
    }
  }
);

// POST /api/zones - Create zone
router.post('/',
  requireAuthAndScope,
  validators.coordinates,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        zoneName,
        zoneX,
        zoneY,
        zoneZ,
        radius = 50,
        type = 'monitor',
        description,
        color = '#FF0000',
        enabled = true,
        notificationChannel
      } = req.body;

      if (!zoneName) {
        return res.status(400).json({ error: 'zoneName is required' });
      }

      const zone = new MonitorZone({
        guildID: guildId,
        serviceId,
        zoneName,
        zoneX,
        zoneY,
        zoneZ,
        radius,
        type,
        description,
        color,
        enabled,
        notificationChannel
      });

      await zone.save();
      res.status(201).json(zone);
    } catch (error) {
      console.error('Error creating zone:', error);
      res.status(500).json({ error: 'Failed to create zone' });
    }
  }
);

// PATCH /api/zones/:id - Update zone
router.patch('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        zoneName,
        zoneX,
        zoneY,
        zoneZ,
        radius,
        type,
        description,
        color,
        enabled,
        notificationChannel
      } = req.body;

      const updateData = {};
      if (zoneName !== undefined) updateData.zoneName = zoneName;
      if (zoneX !== undefined) updateData.zoneX = zoneX;
      if (zoneY !== undefined) updateData.zoneY = zoneY;
      if (zoneZ !== undefined) updateData.zoneZ = zoneZ;
      if (radius !== undefined) updateData.radius = radius;
      if (type !== undefined) updateData.type = type;
      if (description !== undefined) updateData.description = description;
      if (color !== undefined) updateData.color = color;
      if (enabled !== undefined) updateData.enabled = enabled;
      if (notificationChannel !== undefined) updateData.notificationChannel = notificationChannel;

      const zone = await MonitorZone.findOneAndUpdate(
        { _id: req.params.id, guildID: guildId, serviceId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!zone) {
        return res.status(404).json({ error: 'Zone not found' });
      }

      res.json(zone);
    } catch (error) {
      console.error('Error updating zone:', error);
      res.status(500).json({ error: 'Failed to update zone' });
    }
  }
);

// POST /api/zones/:id/toggle - Toggle zone enabled status
router.post('/:id/toggle',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;

      const zone = await MonitorZone.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!zone) {
        return res.status(404).json({ error: 'Zone not found' });
      }

      zone.enabled = !zone.enabled;
      await zone.save();

      res.json(zone);
    } catch (error) {
      console.error('Error toggling zone:', error);
      res.status(500).json({ error: 'Failed to toggle zone' });
    }
  }
);

// DELETE /api/zones/:id - Delete zone
router.delete('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      const zone = await MonitorZone.findOneAndDelete({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!zone) {
        return res.status(404).json({ error: 'Zone not found' });
      }

      res.json({ message: 'Zone deleted successfully', zone });
    } catch (error) {
      console.error('Error deleting zone:', error);
      res.status(500).json({ error: 'Failed to delete zone' });
    }
  }
);

module.exports = router;
