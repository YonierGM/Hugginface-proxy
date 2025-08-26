import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import winston from "winston";

dotenv.config();
const app = express();

// Configuración de logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: {
    error: "Demasiadas peticiones",
    details: "Límite de 100 requests por 15 minutos excedido"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(limiter);

const HF_TOKEN = process.env.HF_TOKEN;
const DEFAULT_MODEL = process.env.HF_MODEL || "meta-llama/Llama-3.1-8B-Instruct:fireworks-ai";

// Modelos disponibles
const AVAILABLE_MODELS = {
  "llama-3.1-8b": "meta-llama/Llama-3.1-8B-Instruct:fireworks-ai",
  "llama-3.1-70b": "meta-llama/Llama-3.1-70B-Instruct:fireworks-ai",
  "mixtral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1:fireworks-ai",
  "qwen-2.5-72b": "Qwen/Qwen2.5-72B-Instruct:fireworks-ai",
  "hermes-3": "NousResearch/Hermes-3-Llama-3.1-8B:fireworks-ai"
};

// Middleware de logging mejorado
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  // Log inmediato de la petición entrante
  console.log(`→ ${req.method} ${req.url} from ${req.ip}`);
  console.log(`  Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`  Body:`, JSON.stringify(req.body, null, 2));
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      model: req.body?.model,
      messageCount: req.body?.messages?.length
    };
    
    console.log(`← Response:`, JSON.stringify(logData, null, 2));
    logger.info('Request completed', logData);
  });
  
  next();
};

app.use(logRequest);

// Endpoint de modelos disponibles
app.get("/v1/models", (req, res) => {
  const models = Object.entries(AVAILABLE_MODELS).map(([name, id]) => ({
    id: name,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "huggingface",
    permission: [],
    root: name,
    parent: null,
    full_model_id: id
  }));
  
  res.json({
    object: "list",
    data: models
  });
});

// Función para crear stream de respuesta
const createStreamResponse = (content) => {
  const chunks = content.split(' ');
  return chunks.map((chunk, index) => {
    const isLast = index === chunks.length - 1;
    const data = {
      id: `stream-${Date.now()}-${index}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: DEFAULT_MODEL,
      choices: [{
        index: 0,
        delta: isLast ? {} : { content: chunk + ' ' },
        finish_reason: isLast ? "stop" : null
      }]
    };
    return `data: ${JSON.stringify(data)}\n\n`;
  });
};

// Endpoint principal de chat
app.post("/v1/chat/completions", async (req, res) => {
  console.log("🚀 Chat completions endpoint hit");
  console.log("📋 Request body:", JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      messages, 
      temperature, 
      max_tokens, 
      stream, 
      model,
      top_p,
      frequency_penalty,
      presence_penalty
    } = req.body;
    
    if (!HF_TOKEN) {
      console.log("❌ No HF_TOKEN found");
      logger.error("Token de Hugging Face no encontrado");
      return res.status(401).json({ 
        error: "Token de Hugging Face no encontrado",
        details: "Configura HF_TOKEN en tu .env" 
      });
    }

    console.log("✅ HF_TOKEN found");

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log("❌ Invalid messages");
      return res.status(400).json({
        error: "Mensajes requeridos",
        details: "El campo 'messages' debe ser un array no vacío"
      });
    }

    // Resolver el modelo
    let selectedModel = DEFAULT_MODEL;
    if (model) {
      selectedModel = AVAILABLE_MODELS[model] || model;
    }

    console.log(`🤖 Using model: ${selectedModel}`);
    logger.info(`Usando modelo: ${selectedModel}`);

    const requestBody = {
      model: selectedModel,
      messages: messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 1000,
      stream: stream || false,
      ...(top_p && { top_p }),
      ...(frequency_penalty && { frequency_penalty }),
      ...(presence_penalty && { presence_penalty })
    };

    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`Error de HF (${response.status}): ${error}`);
      return res.status(response.status).json({ 
        error: "Error desde Hugging Face", 
        details: error,
        status: response.status 
      });
    }

    // Manejo de streaming
    if (stream) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      try {
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/plain') || contentType.includes('text/event-stream')) {
          // Streaming real usando node-fetch
          response.body.on('data', (chunk) => {
            res.write(chunk);
          });
          
          response.body.on('end', () => {
            res.end();
          });
          
          response.body.on('error', (error) => {
            logger.error("Error en stream body:", error);
            res.end();
          });
        } else {
          // Streaming simulado - HF no devolvió streaming real
          logger.info("HF no devolvió streaming, simulando...");
          const data = await response.json();
          const content = data.choices[0]?.message?.content || "Sin respuesta";
          
          // Simular streaming palabra por palabra
          const words = content.split(' ');
          let accumulatedContent = '';
          
          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            accumulatedContent += (i > 0 ? ' ' : '') + word;
            
            const isLast = i === words.length - 1;
            const chunk = {
              id: `simulated-${Date.now()}-${i}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: selectedModel,
              choices: [{
                index: 0,
                delta: isLast ? {} : { content: (i === 0 ? word : ' ' + word) },
                finish_reason: isLast ? "stop" : null
              }]
            };
            
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            
            // Delay entre palabras para simular streaming
            if (!isLast) {
              await new Promise(resolve => setTimeout(resolve, 80));
            }
          }
          
          res.write("data: [DONE]\n\n");
          res.end();
        }
      } catch (streamError) {
        logger.error("Error en streaming:", streamError);
        
        // Fallback: respuesta de error en formato streaming
        const errorChunk = {
          id: "error-" + Date.now(),
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: selectedModel,
          choices: [{
            index: 0,
            delta: { content: `Error: ${streamError.message}` },
            finish_reason: "error"
          }]
        };
        
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } else {
      // Respuesta normal (no streaming)
      const data = await response.json();
      res.json(data);
    }

    logger.info(`Respuesta exitosa para modelo: ${selectedModel}`);

  } catch (err) {
    logger.error("Error del servidor:", err);
    res.status(500).json({ 
      error: "Error en el servidor", 
      details: err.message 
    });
  }
});

// Endpoint de salud mejorado
app.get("/health", (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({ 
    status: "ok", 
    model: DEFAULT_MODEL,
    hasToken: !!HF_TOKEN,
    availableModels: Object.keys(AVAILABLE_MODELS).length,
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
      total: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB"
    },
    timestamp: new Date().toISOString()
  });
});

// Endpoint de estadísticas (opcional)
app.get("/stats", (req, res) => {
  res.json({
    modelsAvailable: AVAILABLE_MODELS,
    defaultModel: DEFAULT_MODEL,
    rateLimit: "100 requests per 15 minutes",
    features: [
      "Streaming support",
      "Multiple models",
      "Request logging",
      "Rate limiting",
      "Health monitoring"
    ]
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  logger.error("Error no manejado:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    details: process.env.NODE_ENV === 'development' ? err.message : 'Contacta al administrador'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 Servidor escuchando en puerto ${PORT}`);
  logger.info(`📝 Modelo por defecto: ${DEFAULT_MODEL}`);
  logger.info(`🔑 Token HF configurado: ${HF_TOKEN ? 'Sí' : 'No'}`);
  logger.info(`🎯 Modelos disponibles: ${Object.keys(AVAILABLE_MODELS).length}`);
  logger.info(`📊 Logging habilitado`);
  logger.info(`⚡ Rate limiting: 100 req/15min`);
});