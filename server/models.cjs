const mongoose = require('mongoose')

const ManagerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  display_id: { type: String, sparse: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String },
  last_set_password: { type: String },
  role: { type: String, default: 'manager' },
  firebase_uid: { type: String },
  provider: { type: String, default: 'firebase' },
  googleId: { type: String },
  avatarUrl: { type: String }
}, { timestamps: true, id: false })

const EmployeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  manager_id: { type: String, required: true },
  display_id: { type: String, sparse: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String },
  last_set_password: { type: String },
  role: { type: String, default: 'employee' },
  firebase_uid: { type: String },
  provider: { type: String, default: 'firebase' },
  googleId: { type: String },
  avatarUrl: { type: String }
}, { timestamps: true, id: false })

const OperatorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  manager_id: { type: String, required: true },
  display_id: { type: String, sparse: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String },
  last_set_password: { type: String },
  role: { type: String, default: 'operator' },
  firebase_uid: { type: String },
  provider: { type: String, default: 'firebase' },
  skills: [{ type: String }],
  status: { type: String, default: 'offline' }, // 'available', 'offline'
  current_load: { type: Number, default: 0 },
  max_load: { type: Number, default: 3 },
  googleId: { type: String },
  avatarUrl: { type: String }
}, { timestamps: true, id: false })

const TicketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  manager_id: { type: String, required: true },
  display_id: { type: String, sparse: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, default: 'open' },
  assigned_to: { type: String, default: null }, // operator id
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  resolved_at: { type: Date, default: null },
  sla_deadline: { type: Date, required: true },
  reporter_name: { type: String, required: true },
  reporter_email: { type: String, required: true },
  reporter_user_id: { type: String, default: null } // employee id
}, { id: false })

const AssignmentLogSchema = new mongoose.Schema({
  manager_id: { type: String, required: true },
  ticket_id: { type: String, required: true },
  operator_id: { type: String, required: true },
  assigned_at: { type: Date, default: Date.now },
  reason: { type: String }
})

const ReportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  manager_id: { type: String, required: true },
  ticket_id: { type: String, required: true },
  ticket: { type: Object, required: true },
  resolved_at: { type: Date, required: true },
  operator_name: { type: String },
  operator_email: { type: String },
  reporter_name: { type: String },
  reporter_email: { type: String },
  sla_status: { type: Object }
}, { id: false })

const TransferRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  manager_id: { type: String, required: true, index: true },
  ticket_id: { type: String, required: true, index: true },
  ticket_title: { type: String, required: true },
  operator_id: { type: String, required: true, index: true },
  operator_name: { type: String },
  operator_email: { type: String },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  requested_at: { type: Date, default: Date.now },
  reviewed_at: { type: Date, default: null },
  reviewed_by: { type: String, default: null },
  review_note: { type: String, default: '' },
}, { id: false })

const SlaRuleSchema = new mongoose.Schema({
  priority: { type: String, required: true, unique: true },
  hours_limit: { type: Number, required: true },
  description: { type: String }
})

const CounterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
})

const SuperAdminSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, default: 'super_admin' },
  firebase_uid: { type: String },
  provider: { type: String, default: 'firebase' },
  created_at: { type: Date, default: Date.now },
}, { timestamps: true, id: false })

const Manager = mongoose.model('Manager', ManagerSchema)
const Employee = mongoose.model('Employee', EmployeeSchema)
const Operator = mongoose.model('Operator', OperatorSchema)
const Ticket = mongoose.model('Ticket', TicketSchema)
const AssignmentLog = mongoose.model('AssignmentLog', AssignmentLogSchema)
const Report = mongoose.model('Report', ReportSchema)
const TransferRequest = mongoose.model('TransferRequest', TransferRequestSchema)
const SlaRule = mongoose.model('SlaRule', SlaRuleSchema)
const Counter = mongoose.model('Counter', CounterSchema)
const SuperAdmin = mongoose.model('SuperAdmin', SuperAdminSchema)

module.exports = {
  Manager,
  Employee,
  Operator,
  Ticket,
  AssignmentLog,
  Report,
  TransferRequest,
  SlaRule,
  Counter,
  SuperAdmin,
}
