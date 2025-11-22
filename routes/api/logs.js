const express = require('express');
const router = express.Router();
const Message = require('../../schemas/gameData/Message');
const { requireAuthAndScope, validators } = require('../../config/validation');

// GET /api/logs - Get server logs/messages
router.get('/',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 100, type, search, startDate, endDate } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId };
      
      // Filter by message type
      if (type) {
        query.messageType = type;
      }

      // Search in content
      if (search) {
        query.$or = [
          { content: { $regex: search, $options: 'i' } },
          { playerName: { $regex: search, $options: 'i' } }
        ];
      }

      // Date range filter
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const logs = await Message.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ timestamp: -1 });

      const count = await Message.countDocuments(query);

      res.json({
        logs,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }
);

// GET /api/logs/stats - Get log statistics
router.get('/stats',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { hours = 24 } = req.query;

      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const stats = await Message.aggregate([
        {
          $match: {
            guildID: guildId,
            serviceId,
            timestamp: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$messageType',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = await Message.countDocuments({
        guildID: guildId,
        serviceId,
        timestamp: { $gte: since }
      });

      res.json({
        period: `${hours} hours`,
        total,
        byType: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      });
    } catch (error) {
      console.error('Error fetching log stats:', error);
      res.status(500).json({ error: 'Failed to fetch log stats' });
    }
  }
);

// POST /api/logs - Create log entry
router.post('/',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        messageType = 'info',
        content,
        playerId,
        playerName,
        location,
        metadata
      } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }

      const log = new Message({
        guildID: guildId,
        serviceId,
        messageType,
        content,
        playerId,
        playerName,
        location,
        metadata,
        timestamp: new Date()
      });

      await log.save();
      res.status(201).json(log);
    } catch (error) {
      console.error('Error creating log:', error);
      res.status(500).json({ error: 'Failed to create log' });
    }
  }
);

// DELETE /api/logs - Clear old logs
router.delete('/',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { olderThan = 30 } = req.query; // Days

      const cutoff = new Date(Date.now() - olderThan * 24 * 60 * 60 * 1000);

      const result = await Message.deleteMany({
        guildID: guildId,
        serviceId,
        timestamp: { $lt: cutoff }
      });

      res.json({
        message: `Cleared ${result.deletedCount} logs older than ${olderThan} days`,
        count: result.deletedCount
      });
    } catch (error) {
      console.error('Error clearing logs:', error);
      res.status(500).json({ error: 'Failed to clear logs' });
    }
  }
);

module.exports = router;
