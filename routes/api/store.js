const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ShopItemSchema = require('../../schemas/economy/ShopItem');
const { requireAuthAndScope } = require('../../config/validation');

// Get or create the ShopItem model
const ShopItem = mongoose.models.ShopItem || mongoose.model('ShopItem', ShopItemSchema);

// GET /api/store/items - Get all shop items organized by shopCategory and itemCategory
router.get('/items',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;

      // Fetch all items for this guild/service
      const items = await ShopItem.find({
        guildID: guildId,
        serviceId: serviceId
      }).sort({ shopCategory: 1, itemCategory: 1, displayOrder: 1, name: 1 });

      // Organize items by shopCategory and itemCategory
      const organized = {};
      const shopCategories = new Set();
      
      items.forEach(item => {
        const shopCat = item.shopCategory;
        const itemCat = item.itemCategory;
        
        shopCategories.add(shopCat);
        
        if (!organized[shopCat]) {
          organized[shopCat] = {};
        }
        
        if (!organized[shopCat][itemCat]) {
          organized[shopCat][itemCat] = [];
        }
        
        organized[shopCat][itemCat].push(item);
      });

      // Fetch channel names from Discord API using bot token
      // Note: User OAuth tokens don't have channel read permissions, so we use the bot token server-side
      const channelNames = {};
      const shopCategoriesArray = Array.from(shopCategories);
      
      console.log('\n=== FETCHING CHANNEL NAMES ===');
      console.log('Bot token available:', !!process.env.DISCORD_BOT_TOKEN);
      console.log('Channel IDs to fetch:', shopCategoriesArray);
      
      if (process.env.DISCORD_BOT_TOKEN) {
        try {
          // Fetch each channel individually using bot token
          await Promise.all(
            shopCategoriesArray.map(async (channelId) => {
              try {
                console.log(`Fetching channel ${channelId}...`);
                const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
                  headers: {
                    'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`
                  }
                });
                
                console.log(`Channel ${channelId} response status:`, response.status);
                
                if (response.ok) {
                  const channel = await response.json();
                  console.log(`Channel ${channelId} data:`, { id: channel.id, name: channel.name, type: channel.type });
                  channelNames[channelId] = channel.name;
                } else {
                  const errorText = await response.text();
                  console.error(`Failed to fetch channel ${channelId}:`, response.status, errorText);
                  channelNames[channelId] = channelId;
                }
              } catch (error) {
                console.error(`Error fetching channel ${channelId}:`, error);
                channelNames[channelId] = channelId;
              }
            })
          );
        } catch (error) {
          console.error('Error fetching channel names:', error);
          shopCategoriesArray.forEach(channelId => {
            channelNames[channelId] = channelId;
          });
        }
      } else {
        console.log('No bot token available, using channel IDs');
        shopCategoriesArray.forEach(channelId => {
          channelNames[channelId] = channelId;
        });
      }
      
      console.log('Final channelNames mapping:', channelNames);
      console.log('=== END FETCHING CHANNEL NAMES ===\n');

      res.json({
        success: true,
        items: items,
        organized: organized,
        channelNames: channelNames
      });
    } catch (error) {
      console.error('Error fetching store items:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch store items' 
      });
    }
  }
);

// GET /api/store/categories - Get all unique shop categories and item categories
router.get('/categories',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;

      const items = await ShopItem.find({
        guildID: guildId,
        serviceId: serviceId
      });

      // Get unique shop categories (channel IDs)
      const shopCategories = [...new Set(items.map(item => item.shopCategory))];
      
      // Get unique item categories per shop category
      const itemCategories = {};
      items.forEach(item => {
        if (!itemCategories[item.shopCategory]) {
          itemCategories[item.shopCategory] = new Set();
        }
        itemCategories[item.shopCategory].add(item.itemCategory);
      });

      // Convert sets to sorted arrays
      Object.keys(itemCategories).forEach(shopCat => {
        itemCategories[shopCat] = Array.from(itemCategories[shopCat]).sort((a, b) => a - b);
      });

      // Fetch channel names from Discord API using bot token
      // Note: User OAuth tokens don't have channel read permissions, so we use the bot token server-side
      const channelNames = {};
      
      console.log('\n=== FETCHING CHANNEL NAMES (categories endpoint) ===');
      console.log('Bot token available:', !!process.env.DISCORD_BOT_TOKEN);
      console.log('Channel IDs to fetch:', shopCategories);
      
      if (process.env.DISCORD_BOT_TOKEN) {
        try {
          // Fetch each channel individually using bot token
          await Promise.all(
            shopCategories.map(async (channelId) => {
              try {
                console.log(`Fetching channel ${channelId}...`);
                const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
                  headers: {
                    'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`
                  }
                });
                
                console.log(`Channel ${channelId} response status:`, response.status);
                
                if (response.ok) {
                  const channel = await response.json();
                  console.log(`Channel ${channelId} data:`, { id: channel.id, name: channel.name, type: channel.type });
                  channelNames[channelId] = channel.name;
                } else {
                  const errorText = await response.text();
                  console.error(`Failed to fetch channel ${channelId}:`, response.status, errorText);
                  channelNames[channelId] = channelId;
                }
              } catch (error) {
                console.error(`Error fetching channel ${channelId}:`, error);
                channelNames[channelId] = channelId;
              }
            })
          );
        } catch (error) {
          console.error('Error fetching channel names:', error);
          shopCategories.forEach(channelId => {
            channelNames[channelId] = channelId;
          });
        }
      } else {
        // No token available, use IDs
        console.log('No bot token available, using channel IDs');
        shopCategories.forEach(channelId => {
          channelNames[channelId] = channelId;
        });
      }
      
      console.log('Final channelNames mapping:', channelNames);
      console.log('=== END FETCHING CHANNEL NAMES ===\n');

      res.json({
        success: true,
        shopCategories: shopCategories,
        channelNames: channelNames,
        itemCategories: itemCategories
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch categories' 
      });
    }
  }
);

// GET /api/store/items/:id - Get single item
router.get('/items/:id',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid item ID' 
        });
      }

      const item = await ShopItem.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId: serviceId
      });

      if (!item) {
        return res.status(404).json({ 
          success: false, 
          error: 'Item not found' 
        });
      }

      res.json({
        success: true,
        item: item
      });
    } catch (error) {
      console.error('Error fetching item:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch item' 
      });
    }
  }
);

// PATCH /api/store/items/:id - Update item details
router.patch('/items/:id',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid item ID' 
        });
      }

      const allowedUpdates = [
        'name', 'description', 'price', 'maxQuantity', 
        'lifetime', 'imagePath', 'factionLevel', 'author'
      ];

      const updateData = {};
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      const item = await ShopItem.findOneAndUpdate(
        { 
          _id: req.params.id, 
          guildID: guildId, 
          serviceId: serviceId 
        },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!item) {
        return res.status(404).json({ 
          success: false, 
          error: 'Item not found' 
        });
      }

      res.json({
        success: true,
        item: item
      });
    } catch (error) {
      console.error('Error updating item:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update item' 
      });
    }
  }
);

// PATCH /api/store/items/:id/move - Move item to different category
router.patch('/items/:id/move',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { shopCategory, itemCategory } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid item ID' 
        });
      }

      if (shopCategory === undefined && itemCategory === undefined) {
        return res.status(400).json({ 
          success: false, 
          error: 'shopCategory or itemCategory required' 
        });
      }

      const updateData = {};
      if (shopCategory !== undefined) updateData.shopCategory = shopCategory;
      if (itemCategory !== undefined) updateData.itemCategory = parseInt(itemCategory);

      const item = await ShopItem.findOneAndUpdate(
        { 
          _id: req.params.id, 
          guildID: guildId, 
          serviceId: serviceId 
        },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!item) {
        return res.status(404).json({ 
          success: false, 
          error: 'Item not found' 
        });
      }

      res.json({
        success: true,
        item: item,
        message: 'Item moved successfully'
      });
    } catch (error) {
      console.error('Error moving item:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to move item' 
      });
    }
  }
);

// POST /api/store/items - Create new shop item
router.post('/items',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const {
        itemID,
        name,
        fileName,
        fileNameFlat,
        description,
        author,
        price,
        maxQuantity,
        lifetime,
        shopCategory,
        itemCategory,
        imagePath,
        factionLevel
      } = req.body;

      // Validate required fields
      if (!itemID || !name || !fileName || price === undefined || 
          !shopCategory || itemCategory === undefined || 
          lifetime === undefined || factionLevel === undefined) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields' 
        });
      }

      const itemData = {
        itemID,
        guildID: guildId,
        serviceId: serviceId,
        name,
        fileName,
        fileNameFlat: fileNameFlat || fileName,
        description: description || 'An Item',
        addedBy: req.user.discordId || req.user.id,
        author: author || '',
        postedDate: new Date(),
        price: parseFloat(price),
        maxQuantity: parseInt(maxQuantity) || 1,
        lifetime: parseInt(lifetime),
        shopCategory,
        itemCategory: parseInt(itemCategory),
        imagePath: imagePath || '',
        factionLevel: parseInt(factionLevel)
      };

      const item = new ShopItem(itemData);
      await item.save();

      res.status(201).json({
        success: true,
        item: item,
        message: 'Item created successfully'
      });
    } catch (error) {
      console.error('Error creating item:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({ 
          success: false, 
          error: 'Item with this ID already exists' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create item' 
      });
    }
  }
);

// DELETE /api/store/items/:id - Delete shop item
router.delete('/items/:id',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid item ID' 
        });
      }

      const item = await ShopItem.findOneAndDelete({
        _id: req.params.id,
        guildID: guildId,
        serviceId: serviceId
      });

      if (!item) {
        return res.status(404).json({ 
          success: false, 
          error: 'Item not found' 
        });
      }

      res.json({
        success: true,
        message: 'Item deleted successfully',
        item: item
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete item' 
      });
    }
  }
);

// PATCH /api/store/categories/rename - Rename a shop or item category
router.patch('/categories/rename',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { type, oldValue, newValue } = req.body;

      if (!type || oldValue === undefined || newValue === undefined) {
        return res.status(400).json({ 
          success: false, 
          error: 'type, oldValue, and newValue required' 
        });
      }

      if (type !== 'shop' && type !== 'item') {
        return res.status(400).json({ 
          success: false, 
          error: 'type must be "shop" or "item"' 
        });
      }

      const query = {
        guildID: guildId,
        serviceId: serviceId
      };

      const update = {};
      
      if (type === 'shop') {
        query.shopCategory = oldValue;
        update.shopCategory = newValue;
      } else {
        query.itemCategory = parseInt(oldValue);
        update.itemCategory = parseInt(newValue);
      }

      const result = await ShopItem.updateMany(query, { $set: update });

      res.json({
        success: true,
        message: `Updated ${result.modifiedCount} items`,
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      console.error('Error renaming category:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to rename category' 
      });
    }
  }
);

// GET /api/store/item-categories - Get item category mappings (default + custom)
router.get('/item-categories',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const path = require('path');
      const fs = require('fs');
      const Globals = require('../../schemas/globals/globals');

      // Default categories (always available)
      const defaultCategories = {
        "1": "Structures",
        "2": "Vehicles",
        "3": "Weapons",
        "4": "Utilities"
      };

      // Try to load custom categories from categoryMapping.json
      const categoryMappingPath = path.join(
        __dirname,
        "../../../tenants",
        serviceId,
        "categoryMapping.json"
      );

      let customFromFile = {};
      try {
        const fileData = await fs.promises.readFile(categoryMappingPath, 'utf8');
        customFromFile = JSON.parse(fileData);
      } catch (error) {
        // File doesn't exist or can't be read, that's okay
      }

      // Get custom categories from database
      const globals = await Globals.findOne({ guildid: guildId });
      let customFromDB = [];
      
      if (globals && globals.Options && globals.Options.Store && globals.Options.Store.Categories) {
        customFromDB = globals.Options.Store.Categories.map(cat => ({
          value: cat.id,
          label: cat.name
        }));
      }

      // Merge all categories
      const allCategories = { ...defaultCategories, ...customFromFile };
      
      // Add custom DB categories
      customFromDB.forEach(cat => {
        allCategories[cat.value] = cat.label;
      });

      res.json({
        success: true,
        categories: allCategories,
        defaultCategories: defaultCategories,
        customCategories: customFromDB
      });
    } catch (error) {
      console.error('Error fetching item categories:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch item categories' 
      });
    }
  }
);

// PATCH /api/store/items/:id/reorder - Update item display order
router.patch('/items/:id/reorder',
  requireAuthAndScope,
  async (req, res) => {
    try {
      const { guildId, serviceId } = req.session;
      const { newOrder, targetItemId, position } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid item ID' 
        });
      }

      const draggedItem = await ShopItem.findOne({
        _id: req.params.id,
        guildID: guildId,
        serviceId: serviceId
      });

      if (!draggedItem) {
        return res.status(404).json({ 
          success: false, 
          error: 'Item not found' 
        });
      }

      // Get all items in the same category
      const itemsInCategory = await ShopItem.find({
        guildID: guildId,
        serviceId: serviceId,
        shopCategory: draggedItem.shopCategory,
        itemCategory: draggedItem.itemCategory
      }).sort({ displayOrder: 1, name: 1 });

      // Remove dragged item from array
      const filteredItems = itemsInCategory.filter(item => item._id.toString() !== req.params.id);

      // Find insert position
      let insertIndex = 0;
      if (targetItemId && position) {
        const targetIndex = filteredItems.findIndex(item => item._id.toString() === targetItemId);
        if (targetIndex !== -1) {
          insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        }
      } else if (newOrder !== undefined) {
        insertIndex = parseInt(newOrder);
      }

      // Insert dragged item at new position
      filteredItems.splice(insertIndex, 0, draggedItem);

      // Update display orders
      const bulkOps = filteredItems.map((item, index) => ({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { displayOrder: index } }
        }
      }));

      await ShopItem.bulkWrite(bulkOps);

      console.log('\n=== ITEM REORDERED ===');
      console.log(`Item ${req.params.id} reordered in category ${draggedItem.shopCategory}/${draggedItem.itemCategory}`);
      console.log(`Updated ${bulkOps.length} item display orders`);
      console.log('NOTE: Discord bot should query with .sort({ displayOrder: 1 }) to respect this order');
      console.log('=== END REORDER ===\n');

      res.json({
        success: true,
        message: 'Item order updated successfully',
        note: 'Discord bot must query ShopItem.find().sort({ displayOrder: 1 }) to display items in this order'
      });
    } catch (error) {
      console.error('Error reordering item:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to reorder item' 
      });
    }
  }
);

module.exports = router;
