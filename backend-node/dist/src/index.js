"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const winston_1 = __importDefault(require("winston"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Environment configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eisenhower';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const NODE_ENV = process.env.NODE_ENV || 'development';
// Winston Logger Setup
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'eisenhower-api' },
    transports: [
        new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'combined.log' }),
    ],
});
if (NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.simple(),
    }));
}
mongoose_1.default.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
// Swagger setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Eisenhower Matrix API',
            version: '1.0.0',
            description: 'AI-powered Eisenhower Matrix API for intelligent task prioritization',
            contact: {
                name: 'API Support',
                email: 'support@eisenhower.ai',
            },
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Development server',
            },
        ],
        components: {
            schemas: {
                Task: {
                    type: 'object',
                    required: ['title', 'urgent', 'important'],
                    properties: {
                        _id: {
                            type: 'string',
                            description: 'Unique task identifier',
                        },
                        title: {
                            type: 'string',
                            description: 'Task title',
                            example: 'Complete project proposal',
                        },
                        description: {
                            type: 'string',
                            description: 'Task description',
                            example: 'Write and finalize the Q1 project proposal document',
                        },
                        urgent: {
                            type: 'boolean',
                            description: 'Whether the task is urgent',
                            example: true,
                        },
                        important: {
                            type: 'boolean',
                            description: 'Whether the task is important',
                            example: true,
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Creation timestamp',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Last update timestamp',
                        },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                        },
                    },
                },
                Health: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['healthy', 'unhealthy'],
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                        },
                        services: {
                            type: 'object',
                            properties: {
                                database: {
                                    type: 'string',
                                    enum: ['connected', 'disconnected'],
                                },
                                ai: {
                                    type: 'string',
                                    enum: ['healthy', 'unhealthy', 'unreachable'],
                                },
                            },
                        },
                    },
                },
            },
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/index.ts'], // files containing annotations
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
// Swagger UI route
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
// OpenAPI JSON route
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});
const TaskSchema = new mongoose_1.default.Schema({
    title: { type: String, required: true },
    description: String,
    urgent: { type: Boolean, default: false },
    important: { type: Boolean, default: false },
}, { timestamps: true });
const Task = mongoose_1.default.model('Task', TaskSchema);
// User Schema for Authentication
const UserSchema = new mongoose_1.default.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    try {
        const salt = await bcryptjs_1.default.genSalt(12);
        this.password = await bcryptjs_1.default.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
const User = mongoose_1.default.model('User', UserSchema);
// Routes
app.get('/tasks', async (req, res) => {
    try {
        const tasks = await Task.find();
        res.json(tasks);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});
app.post('/tasks', async (req, res) => {
    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json(task);
    }
    catch (err) {
        res.status(400).json({ error: 'Failed to create task' });
    }
});
app.put('/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!task)
            return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    }
    catch (err) {
        res.status(400).json({ error: 'Failed to update task' });
    }
});
app.delete('/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task)
            return res.status(404).json({ error: 'Task not found' });
        res.json({ message: 'Task deleted' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
});
// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealth = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: dbHealth,
                ai: await checkAIService()
            }
        });
    }
    catch (err) {
        res.status(503).json({
            status: 'unhealthy',
            error: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Check AI service health
async function checkAIService() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(AI_SERVICE_URL, {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' }
        });
        clearTimeout(timeoutId);
        return response.ok ? 'healthy' : 'unhealthy';
    }
    catch {
        return 'unreachable';
    }
}
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
