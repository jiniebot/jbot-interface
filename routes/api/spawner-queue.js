const express = require('express');
const router = express.Router();
const ActiveObjSp = require('../../schemas/gameData/ActiveObjSp');
const { requireAuthAndScope, validators } = require('../../config/validation');

// GET /api/spawner-queue - List spawner queue items
router.get('/',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 50, status } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId };
      
      if (status) query.status = status;

      const items = await ActiveObjSp.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const count = await ActiveObjSp.countDocuments(query);

      res.json({
        items,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching spawner queue:', error);
      res.status(500).json({ error: 'Failed to fetch spawner queue' });
    }
  }
);

// GET /api/spawner-queue/:id - Get single queue item
router.get('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const item = await ActiveObjSp.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!item) {
        return res.status(404).json({ error: 'Queue item not found' });
      }

      res.json(item);
    } catch (error) {
      console.error('Error fetching queue item:', error);
      res.status(500).json({ error: 'Failed to fetch queue item' });
    }
  }
);

// POST /api/spawner-queue - Add item to spawner queue
router.post('/',
  requireAuthAndScope,
  validators.coordinates,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        objectClass,
        posX,
        posY,
        posZ,
        targetUserId,
        targetGamertag,
        quantity = 1,
        itemCondition = 'Pristine',
        priority = 'normal',
        notes
      } = req.body;

      if (!objectClass) {
        return res.status(400).json({ error: 'objectClass is required' });
      }

      const item = new ActiveObjSp({
        guildID: guildId,
        serviceId,
        objectClass,
        posX,
        posY,
        posZ,
        targetUserId,
        targetGamertag,
        quantity,
        itemCondition,
        priority,
        notes,
        status: 'pending'
      });

      await item.save();
      res.status(201).json(item);
    } catch (error) {
      console.error('Error adding to spawner queue:', error);
      res.status(500).json({ error: 'Failed to add to spawner queue' });
    }
  }
);

// PATCH /api/spawner-queue/:id - Update queue item
router.patch('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        objectClass,
        posX,
        posY,
        posZ,
        quantity,
        itemCondition,
        priority,
        notes,
        status
      } = req.body;

      const updateData = {};
      if (objectClass !== undefined) updateData.objectClass = objectClass;
      if (posX !== undefined) updateData.posX = posX;
      if (posY !== undefined) updateData.posY = posY;
      if (posZ !== undefined) updateData.posZ = posZ;
      if (quantity !== undefined) updateData.quantity = quantity;
      if (itemCondition !== undefined) updateData.itemCondition = itemCondition;
      if (priority !== undefined) updateData.priority = priority;
      if (notes !== undefined) updateData.notes = notes;
      if (status !== undefined) updateData.status = status;

      if (status === 'completed') {
        updateData.spawnedAt = new Date();
      }

      const item = await ActiveObjSp.findOneAndUpdate(
        { _id: req.params.id, guildID: guildId, serviceId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!item) {
        return res.status(404).json({ error: 'Queue item not found' });
      }

      res.json(item);
    } catch (error) {
      console.error('Error updating queue item:', error);
      res.status(500).json({ error: 'Failed to update queue item' });
    }
  }
);

// POST /api/spawner-queue/:id/complete - Mark item as spawned
router.post('/:id/complete',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;

      const item = await ActiveObjSp.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!item) {
        return res.status(404).json({ error: 'Queue item not found' });
      }

      if (item.status === 'completed') {
        return res.status(400).json({ error: 'Item already spawned' });
      }

      item.status = 'completed';
      item.spawnedAt = new Date();
      await item.save();

      res.json(item);
    } catch (error) {
      console.error('Error completing spawn:', error);
      res.status(500).json({ error: 'Failed to complete spawn' });
    }
  }
);

// POST /api/spawner-queue/bulk - Bulk add items
router.post('/bulk',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items array required' });
      }

      const queueItems = items.map(item => ({
        guildID: guildId,
        serviceId,
        objectClass: item.objectClass,
        posX: item.posX,
        posY: item.posY,
        posZ: item.posZ,
        targetUserId: item.targetUserId,
        targetGamertag: item.targetGamertag,
        quantity: item.quantity || 1,
        itemCondition: item.itemCondition || 'Pristine',
        priority: item.priority || 'normal',
        notes: item.notes,
        status: 'pending'
      }));

      const created = await ActiveObjSp.insertMany(queueItems);
      res.status(201).json({ count: created.length, items: created });
    } catch (error) {
      console.error('Error bulk adding to spawner queue:', error);
      res.status(500).json({ error: 'Failed to bulk add to spawner queue' });
    }
  }
);

// DELETE /api/spawner-queue/:id - Delete queue item
router.delete('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      const item = await ActiveObjSp.findOneAndDelete({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!item) {
        return res.status(404).json({ error: 'Queue item not found' });
      }

      res.json({ message: 'Queue item deleted successfully', item });
    } catch (error) {
      console.error('Error deleting queue item:', error);
      res.status(500).json({ error: 'Failed to delete queue item' });
    }
  }
);

// DELETE /api/spawner-queue - Clear completed items
router.delete('/',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      const result = await ActiveObjSp.deleteMany({
        guildID: guildId,
        serviceId,
        status: 'completed'
      });

      res.json({ 
        message: `${result.deletedCount} completed items cleared`,
        count: result.deletedCount 
      });
    } catch (error) {
      console.error('Error clearing queue:', error);
      res.status(500).json({ error: 'Failed to clear queue' });
    }
  }
);

module.exports = router;
