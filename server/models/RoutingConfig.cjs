const mongoose = require('mongoose')

const RoutingConfigSchema = new mongoose.Schema({
  id: { type: String, default: 'default', unique: true },
  max_load_global: { type: Number, default: 5 },
  priority_weights: {
    critical: { type: Number, default: 4 },
    high: { type: Number, default: 3 },
    medium: { type: Number, default: 2 },
    low: { type: Number, default: 1 },
  },
  skill_routing_enabled: { type: Boolean, default: true },
  load_balancing_enabled: { type: Boolean, default: true },
  priority_boost_enabled: { type: Boolean, default: true },
  updated_at: { type: Date, default: Date.now },
})

const RoutingConfig = mongoose.model('RoutingConfig', RoutingConfigSchema)
module.exports = { RoutingConfig }
