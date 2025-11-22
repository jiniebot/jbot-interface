const mongoose = require("mongoose");

/**
 * Get a scoped Mongoose model that automatically filters by guildID and serviceId
 * @param {string} modelName - Name of the model
 * @param {Schema} schema - Mongoose schema
 * @param {string} guildId - Guild ID to scope to
 * @param {string} serviceId - Service ID to scope to
 * @returns {Proxy} Proxied model with automatic guildID/serviceId filtering
 */
function getModelForService(modelName, schema, guildId, serviceId) {
  const model = mongoose.models[modelName] || mongoose.model(modelName, schema);

  function addServiceGuildIdCondition(conditions) {
    return { ...conditions, guildID: guildId, serviceId: serviceId };
  }

  return new Proxy(model, {
    get(target, property, receiver) {
      const original = target[property];
      if (typeof original === "function") {
        const methodsToModify = [
          "find",
          "findOne",
          "update",
          "findOneAndUpdate",
          "updateMany",
          "updateOne",
          "deleteOne",
          "deleteMany",
          "replaceOne",
          "count",
          "countDocuments",
          "aggregate",
        ];
        if (methodsToModify.includes(property)) {
          return function (conditions = {}, ...args) {
            conditions = addServiceGuildIdCondition(conditions);
            const query = original.call(this, conditions, ...args);
            // Capture collection name right after query creation
            const collection = query && query.model && query.model.collection && query.model.collection.name ? query.model.collection.name : "unknown";
            // Wrap exec for timing
            if (query && typeof query.exec === "function") {
              const origExec = query.exec;
              query.exec = function (...execArgs) {
                const start = process.hrtime.bigint();
                return origExec.apply(this, execArgs).then((result) => {
                  const end = process.hrtime.bigint();
                  const ms = Number(end - start) / 1e6;
                  if (ms > 3000) {
                    // Get a short stack trace (skip this function and Mongoose internals)
                    let stack = new Error().stack;
                    let callerLine = "";
                    if (stack) {
                      const stackLines = stack.split("\n");
                      // Find the first line that is not Node internals, not node_modules, not database.js
                      for (let i = 2; i < stackLines.length; i++) {
                        const line = stackLines[i];
                        if (
                          !line.includes("node_modules") &&
                          !line.includes("database.js") &&
                          !line.includes("node:") &&
                          !line.includes("internal/") &&
                          !line.includes("timers.js") &&
                          !line.includes("events.js")
                        ) {
                          callerLine = line.trim();
                          break;
                        }
                      }
                    }
                    console.warn(
                      `[DB Timing][Service] ${property} on [${collection}] took ${ms.toFixed(2)}ms\n  Called from: ${callerLine}`,
                      conditions
                    );
                  }
                  return result;
                });
              };
            }
            return query;
          };
        }
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

module.exports = { getModelForService };
