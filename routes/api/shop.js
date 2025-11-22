const express = require('express');
const router = express.Router();
const ShopItem = require('../../schemas/economy/ShopItem');
const Purchase = require('../../schemas/economy/Purchase');
const { requireAuthAndScope, validators } = require('../../config/validation');

// GET /api/shop/items - List shop items
router.get('/items',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, category, inStock } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId, isAvailable: true };
      
      if (category) query.category = category;
      if (inStock === 'true') query.stock = { $gt: 0 };

      const items = await ShopItem.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ category: 1, itemName: 1 });

      const count = await ShopItem.countDocuments(query);

      res.json({
        items,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching shop items:', error);
      res.status(500).json({ error: 'Failed to fetch shop items' });
    }
  }
);

// GET /api/shop/items/:id - Get single item
router.get('/items/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const item = await ShopItem.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!item) {
        return res.status(404).json({ error: 'Shop item not found' });
      }

      res.json(item);
    } catch (error) {
      console.error('Error fetching shop item:', error);
      res.status(500).json({ error: 'Failed to fetch shop item' });
    }
  }
);

// POST /api/shop/items - Create shop item
router.post('/items',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        itemName,
        category,
        description,
        price,
        currency = 'credits',
        stock,
        maxPerUser,
        imageUrl,
        deliveryMethod = 'spawner',
        isAvailable = true
      } = req.body;

      if (!itemName || !category || price === undefined) {
        return res.status(400).json({ 
          error: 'itemName, category, and price required' 
        });
      }

      const item = new ShopItem({
        guildID: guildId,
        serviceId,
        itemName,
        category,
        description,
        price,
        currency,
        stock,
        maxPerUser,
        imageUrl,
        deliveryMethod,
        isAvailable
      });

      await item.save();
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating shop item:', error);
      res.status(500).json({ error: 'Failed to create shop item' });
    }
  }
);

// PATCH /api/shop/items/:id - Update shop item
router.patch('/items/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const allowedUpdates = [
        'itemName', 'description', 'price', 'currency', 'stock',
        'maxPerUser', 'imageUrl', 'deliveryMethod', 'isAvailable'
      ];

      const updateData = {};
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      const item = await ShopItem.findOneAndUpdate(
        { _id: req.params.id, guildID: guildId, serviceId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!item) {
        return res.status(404).json({ error: 'Shop item not found' });
      }

      res.json(item);
    } catch (error) {
      console.error('Error updating shop item:', error);
      res.status(500).json({ error: 'Failed to update shop item' });
    }
  }
);

// POST /api/shop/purchase - Purchase an item
router.post('/purchase',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { userId, itemId, quantity = 1 } = req.body;

      if (!userId || !itemId) {
        return res.status(400).json({ error: 'userId and itemId required' });
      }

      // Get the item
      const item = await ShopItem.findOne({
        _id: itemId,
        guildID: guildId,
        serviceId,
        isAvailable: true
      });

      if (!item) {
        return res.status(404).json({ error: 'Item not available' });
      }

      // Check stock
      if (item.stock !== undefined && item.stock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }

      // Check max per user
      if (item.maxPerUser) {
        const userPurchases = await Purchase.countDocuments({
          userId,
          itemId,
          guildID: guildId,
          serviceId,
          status: { $in: ['pending', 'delivered'] }
        });

        if (userPurchases + quantity > item.maxPerUser) {
          return res.status(400).json({ 
            error: `Maximum ${item.maxPerUser} per user` 
          });
        }
      }

      // Create purchase
      const purchase = new Purchase({
        userId,
        itemId,
        guildID: guildId,
        serviceId,
        quantity,
        totalPrice: item.price * quantity,
        currency: item.currency,
        status: 'pending'
      });

      await purchase.save();

      // Update stock
      if (item.stock !== undefined) {
        item.stock -= quantity;
        await item.save();
      }

      res.status(201).json(purchase);
    } catch (error) {
      console.error('Error processing purchase:', error);
      res.status(500).json({ error: 'Failed to process purchase' });
    }
  }
);

// GET /api/shop/purchases - List purchases
router.get('/purchases',
  requireAuthAndScope,
  validators.pagination,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, userId, status } = req.query;
      const { guildId, serviceId } = req.session;

      const query = { guildID: guildId, serviceId };
      
      if (userId) query.userId = userId;
      if (status) query.status = status;

      const purchases = await Purchase.find(query)
        .populate('itemId')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ purchaseDate: -1 });

      const count = await Purchase.countDocuments(query);

      res.json({
        purchases,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      console.error('Error fetching purchases:', error);
      res.status(500).json({ error: 'Failed to fetch purchases' });
    }
  }
);

// PATCH /api/shop/purchases/:id - Update purchase status
router.patch('/purchases/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { status } = req.body;

      if (!['pending', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const purchase = await Purchase.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!purchase) {
        return res.status(404).json({ error: 'Purchase not found' });
      }

      purchase.status = status;
      if (status === 'delivered') {
        purchase.deliveredAt = new Date();
      }

      await purchase.save();
      res.json(purchase);
    } catch (error) {
      console.error('Error updating purchase:', error);
      res.status(500).json({ error: 'Failed to update purchase' });
    }
  }
);

// DELETE /api/shop/items/:id - Delete shop item
router.delete('/items/:id',
  requireAuthAndScope,
  validators.objectId,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      const item = await ShopItem.findOneAndDelete({
        _id: req.params.id,
        guildID: guildId,
        serviceId
      });

      if (!item) {
        return res.status(404).json({ error: 'Shop item not found' });
      }

      res.json({ message: 'Shop item deleted successfully', item });
    } catch (error) {
      console.error('Error deleting shop item:', error);
      res.status(500).json({ error: 'Failed to delete shop item' });
    }
  }
);

module.exports = router;
