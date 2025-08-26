import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN;
const MODEL = process.env.HF_MODEL || "meta-llama/Llama-3.1-8B-Instruct:fireworks-ai";

// Endpoint compatible con OpenAI
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { messages, temperature, max_tokens, stream } = req.body;
    
    // Validar que tenemos el token
    if (!HF_TOKEN) {
      return res.status(401).json({ 
        error: "Token de Hugging Face no encontrado",
        details: "Asegúrate de que HF_TOKEN esté configurado en tu .env" 
      });
    }

    // Usar la URL correcta del router de Hugging Face (compatible con OpenAI)
    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 1000,
        stream: stream || false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error de HF:", error);
      return res.status(response.status).json({ 
        error: "Error desde Hugging Face", 
        details: error,
        status: response.status 
      });
    }

    const data = await response.json();
    
    // La respuesta ya viene en formato OpenAI, solo la pasamos
    res.json(data);

  } catch (err) {
    console.error("Error del servidor:", err);
    res.status(500).json({ 
      error: "Error en el servidor", 
      details: err.message 
    });
  }
});

// Endpoint de salud
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    model: MODEL,
    hasToken: !!HF_TOKEN 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
  console.log(`📝 Modelo configurado: ${MODEL}`);
  console.log(`🔑 Token HF configurado: ${HF_TOKEN ? 'Sí' : 'No'}`);
});