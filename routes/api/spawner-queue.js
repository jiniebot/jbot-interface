const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const ActiveObjSp = require('../../schemas/gameData/ActiveObjSp');
const { requireAuthAndScope, validators } = require('../../config/validation');
const {
  validateDayZFile,
  sanitizeFilename,
  MAX_FILE_SIZE
} = require('../../config/fileValidation');
const { addToQueue } = require('../../utils/queueHelper');
const cache = require('../../utils/cache');

// Lazy-load node-fetch (ES module) for file upload forwarding
let cachedFetch = null;
const fetch = (...args) => {
  if (cachedFetch) return cachedFetch(...args);
  return import('node-fetch').then(({ default: fn }) => {
    cachedFetch = fn;
    return fn(...args);
  });
};

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store in memory for validation
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Basic pre-validation
    if (!file.originalname.toLowerCase().endsWith('.json')) {
      return cb(new Error('Only .json files are allowed'), false);
    }
    cb(null, true);
  }
});

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
      
      // Invalidate spawners cache
      cache.invalidate(cache.generateKey('map:spawners', guildId, serviceId));
      
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

      // Invalidate spawners cache
      cache.invalidate(cache.generateKey('map:spawners', guildId, serviceId));

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

      // Invalidate spawners cache
      cache.invalidate(cache.generateKey('map:spawners', guildId, serviceId));

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
      
      // Invalidate spawners cache
      cache.invalidate(cache.generateKey('map:spawners', guildId, serviceId));
      
      res.status(201).json({ count: created.length, items: created });
    } catch (error) {
      console.error('Error bulk adding to spawner queue:', error);
      res.status(500).json({ error: 'Failed to bulk add to spawner queue' });
    }
  }
);

// DELETE /api/spawner-queue/:id - Queue spawned object for removal
router.delete('/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      // Find the spawned object
      const item = await ActiveObjSp.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!item) {
        return res.status(404).json({ error: 'Spawned object not found' });
      }

      const fileName = item.fileName.replace(/\.json$/i, '');

      // Add to queue with "remove" action using the shared helper
      const queueData = await addToQueue(serviceId, fileName, 'remove');

      // Invalidate spawners cache
      cache.invalidate(cache.generateKey('map:spawners', guildId, serviceId));

      res.json({ 
        message: 'Object queued for removal',
        item: {
          id: item._id,
          fileName: item.fileName,
          objectClass: item.fileName
        },
        queue: queueData.queue
      });
    } catch (error) {
      console.error('Error queuing object for removal:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to queue object for removal'
      });
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

      // Invalidate spawners cache
      cache.invalidate(cache.generateKey('map:spawners', guildId, serviceId));

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

// POST /api/spawner-queue/upload - Upload and validate DayZ JSON file
router.post('/upload',
  requireAuthAndScope,
  upload.single('file'),
  async (req, res) => {
    try {
      const { serviceId } = req.session;
      const { fileType } = req.body; // 'pra', 'spawngear', or 'spawner'

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Parse JSON from buffer for validation
      let jsonData;
      try {
        jsonData = JSON.parse(req.file.buffer.toString('utf8'));
      } catch (parseError) {
        return res.status(400).json({ 
          error: 'Invalid JSON file',
          details: 'File could not be parsed as valid JSON'
        });
      }

      // Validate the file locally first
      const validation = validateDayZFile(req.file, jsonData, fileType);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'File validation failed',
          details: validation.error
        });
      }

      // Forward the upload to the queue API server via multipart
      const queueApiUrl = process.env.QUEUE_API_BASE || 
                          process.env.DASHBOARD_API_BASE || 
                          `http://localhost:${process.env.DASHBOARD_API_PORT || 4310}`;
      const apiKey = process.env.QUEUE_API_KEY || 
                     process.env.DASHBOARD_API_KEY || 
                     process.env.API_KEY;

      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: 'application/json'
      });
      formData.append('fileType', validation.type);

      // Forward to queue API server
      const uploadResponse = await fetch(
        `${queueApiUrl}/services/${serviceId}/upload`,
        {
          method: 'POST',
          headers: {
            ...(apiKey ? { 'X-API-Key': apiKey } : {}),
            ...formData.getHeaders()
          },
          body: formData
        }
      );

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        return res.status(uploadResponse.status).json(uploadResult);
      }

      console.log(`File uploaded to backend for service ${serviceId}: ${uploadResult.file?.savedName}`);

      // Return success with file info
      res.status(201).json(uploadResult);
    } catch (error) {
      console.error('Error uploading file:', error);
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: 'File too large',
          details: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        });
      }
      
      res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
  }
);

// GET /api/spawner-queue/files - List uploaded files
router.get('/files',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { serviceId } = req.session;
      const { type } = req.query; // Filter by type: 'pra', 'spawngear', 'spawner'

      const baseDir = path.join(__dirname, '../../obj_spawner_files', serviceId.toString());
      const files = [];

      // Helper function to read directory
      const readDirSafe = (dir) => {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
          .filter(f => f.endsWith('.json'))
          .map(f => {
            const filePath = path.join(dir, f);
            const stats = fs.statSync(filePath);
            return {
              name: f,
              path: path.relative(baseDir, filePath),
              size: stats.size,
              modified: stats.mtime
            };
          });
      };

      // Read files based on type filter
      if (!type || type === 'pra') {
        const praDir = path.join(baseDir, 'pra');
        files.push(...readDirSafe(praDir).map(f => ({ ...f, type: 'pra' })));
      }

      if (!type || type === 'spawngear') {
        const customDir = path.join(baseDir, 'custom');
        const customFiles = readDirSafe(customDir)
          .filter(f => f.name.startsWith('JinieBotLoadout_'))
          .map(f => ({ ...f, type: 'spawngear' }));
        files.push(...customFiles);
      }

      if (!type || type === 'spawner') {
        const customDir = path.join(baseDir, 'custom');
        const customFiles = readDirSafe(customDir)
          .filter(f => !f.name.startsWith('JinieBotLoadout_'))
          .map(f => ({ ...f, type: 'spawner' }));
        files.push(...customFiles);
      }

      res.json({ files, count: files.length });
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  }
);

// DELETE /api/spawner-queue/files/:filename - Delete uploaded file
router.delete('/files/:filename',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { serviceId } = req.session;
      const { filename } = req.params;

      // Validate filename
      if (!filename.endsWith('.json') || filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const baseDir = path.join(__dirname, '../../obj_spawner_files', serviceId.toString());
      
      // Check in multiple possible locations
      const possiblePaths = [
        path.join(baseDir, 'pra', filename),
        path.join(baseDir, 'custom', filename),
        path.join(baseDir, filename)
      ];

      let deletedPath = null;
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedPath = filePath;
          break;
        }
      }

      if (!deletedPath) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({ 
        message: 'File deleted successfully',
        filename
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
);

/**
 * Extract metadata from file based on type
 */
function getFileMetadata(data, type) {
  const metadata = {};

  if (type === 'pra') {
    metadata.areaName = data.areaName;
    metadata.praBoxCount = data.PRABoxes?.length || 0;
    metadata.praPolygonCount = data.PRAPolygons?.length || 0;
    metadata.safePositionCount = data.safePositions3D?.length || 0;
  } else if (type === 'spawngear') {
    metadata.name = data.name || 'Unnamed';
    metadata.spawnWeight = data.spawnWeight;
    metadata.hasAttachmentSlots = Array.isArray(data.attachmentSlotItemSets) && data.attachmentSlotItemSets.length > 0;
    metadata.hasDiscreteItems = Array.isArray(data.discreteUnsortedItemSets) && data.discreteUnsortedItemSets.length > 0;
  } else if (type === 'spawner') {
    if (Array.isArray(data)) {
      metadata.objectCount = data.length;
    } else {
      metadata.objectCount = Object.keys(data).length;
    }
  }

  return metadata;
}

module.exports = router;
