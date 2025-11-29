/**
 * In-memory cache utility for reducing database load
 * Implements per-service caching with TTL (Time To Live)
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 30000; // 30 seconds default
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(namespace, guildId, serviceId, additionalKey = '') {
    return `${namespace}:${guildId}:${serviceId}${additionalKey ? ':' + additionalKey : ''}`;
  }

  /**
   * Get cached data
   */
  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache data with TTL
   */
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    let expired = 0;
    let valid = 0;
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Run cleanup every 5 minutes
setInterval(() => {
  cacheManager.cleanup();
}, 5 * 60 * 1000);

module.exports = cacheManager;
