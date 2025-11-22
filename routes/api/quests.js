const express = require('express');
const router = express.Router();
const QuestTemplate = require('../../schemas/gameData/QuestTemplate');
const Quest = require('../../schemas/userData/Quest');
const { requireAuthAndScope, validators } = require('../../config/validation');

// GET /api/quests/templates - List quest templates
router.get('/templates',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, type, difficulty } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId, isActive: true };
      
      if (type) query.questType = type;
      if (difficulty) query.difficulty = difficulty;

      const templates = await QuestTemplate.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const count = await QuestTemplate.countDocuments(query);

      res.json({
        templates,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching quest templates:', error);
      res.status(500).json({ error: 'Failed to fetch quest templates' });
    }
  }
);

// GET /api/quests/templates/:id - Get single template
router.get('/templates/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const template = await QuestTemplate.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!template) {
        return res.status(404).json({ error: 'Quest template not found' });
      }

      res.json(template);
    } catch (error) {
      console.error('Error fetching quest template:', error);
      res.status(500).json({ error: 'Failed to fetch quest template' });
    }
  }
);

// POST /api/quests/templates - Create quest template
router.post('/templates',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        questName,
        questType,
        description,
        objectives,
        rewards,
        difficulty = 'medium',
        timeLimit,
        requirements,
        repeatable = false,
        isActive = true
      } = req.body;

      if (!questName || !questType || !objectives || !rewards) {
        return res.status(400).json({ 
          error: 'questName, questType, objectives, and rewards required' 
        });
      }

      const template = new QuestTemplate({
        guildID: guildId,
        serviceId,
        questName,
        questType,
        description,
        objectives,
        rewards,
        difficulty,
        timeLimit,
        requirements,
        repeatable,
        isActive
      });

      await template.save();
      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating quest template:', error);
      res.status(500).json({ error: 'Failed to create quest template' });
    }
  }
);

// PATCH /api/quests/templates/:id - Update quest template
router.patch('/templates/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const allowedUpdates = [
        'questName', 'description', 'objectives', 'rewards',
        'difficulty', 'timeLimit', 'requirements', 'repeatable', 'isActive'
      ];

      const updateData = {};
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      const template = await QuestTemplate.findOneAndUpdate(
        { _id: req.params.id, guildID: guildId, serviceId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!template) {
        return res.status(404).json({ error: 'Quest template not found' });
      }

      res.json(template);
    } catch (error) {
      console.error('Error updating quest template:', error);
      res.status(500).json({ error: 'Failed to update quest template' });
    }
  }
);

// GET /api/quests/active - List active player quests
router.get('/active',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, userId, status } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId };
      
      if (userId) query.userId = userId;
      if (status) query.status = status;

      const quests = await Quest.find(query)
        .populate('questTemplate')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ startedAt: -1 });

      const count = await Quest.countDocuments(query);

      res.json({
        quests,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching active quests:', error);
      res.status(500).json({ error: 'Failed to fetch active quests' });
    }
  }
);

// POST /api/quests/active - Assign quest to player
router.post('/active',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { userId, questTemplateId } = req.body;

      if (!userId || !questTemplateId) {
        return res.status(400).json({ 
          error: 'userId and questTemplateId required' 
        });
      }

      // Verify template exists and is active
      const template = await QuestTemplate.findOne({
        _id: questTemplateId,
        guildID: guildId,
        serviceId,
        isActive: true
      });

      if (!template) {
        return res.status(404).json({ error: 'Quest template not found or inactive' });
      }

      // Check if player already has this quest (if not repeatable)
      if (!template.repeatable) {
        const existing = await Quest.findOne({
          userId,
          questTemplate: questTemplateId,
          guildID: guildId,
          serviceId,
          status: { $in: ['active', 'completed'] }
        });

        if (existing) {
          return res.status(400).json({ error: 'Player already has this quest' });
        }
      }

      const quest = new Quest({
        userId,
        questTemplate: questTemplateId,
        guildID: guildId,
        serviceId,
        status: 'active',
        progress: template.objectives.map(obj => ({
          objectiveId: obj._id,
          current: 0,
          target: obj.target,
          completed: false
        })),
        startedAt: new Date(),
        expiresAt: template.timeLimit ? 
          new Date(Date.now() + template.timeLimit * 60000) : null
      });

      await quest.save();
      await quest.populate('questTemplate');
      
      res.status(201).json(quest);
    } catch (error) {
      console.error('Error assigning quest:', error);
      res.status(500).json({ error: 'Failed to assign quest' });
    }
  }
);

// PATCH /api/quests/active/:id - Update quest progress
router.patch('/active/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { progress, status } = req.body;

      const quest = await Quest.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!quest) {
        return res.status(404).json({ error: 'Quest not found' });
      }

      if (progress) quest.progress = progress;
      if (status) quest.status = status;

      if (status === 'completed') {
        quest.completedAt = new Date();
      }

      await quest.save();
      await quest.populate('questTemplate');
      
      res.json(quest);
    } catch (error) {
      console.error('Error updating quest:', error);
      res.status(500).json({ error: 'Failed to update quest' });
    }
  }
);

// DELETE /api/quests/templates/:id - Delete template
router.delete('/templates/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      const template = await QuestTemplate.findOneAndDelete({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!template) {
        return res.status(404).json({ error: 'Quest template not found' });
      }

      res.json({ message: 'Quest template deleted successfully', template });
    } catch (error) {
      console.error('Error deleting quest template:', error);
      res.status(500).json({ error: 'Failed to delete quest template' });
    }
  }
);

module.exports = router;
