# Proxy para usar modelos de Hugging Face bajo el formato de OpenAI

Un proxy que permite usar modelos de Hugging Face con cualquier herramienta que espere la API de OpenAI, como n8n, LangChain, o aplicaciones personalizadas.

## ✨ Características

- 🔄 **Formato OpenAI**: Convierte automáticamente entre formatos
- 🚀 **Streaming**: Soporte para respuestas en tiempo real
- 🎯 **Múltiples modelos**: Llama, Mixtral, Qwen, Hermes y más
- 📊 **Logging**: Registro detallado de todas las peticiones
- ⚡ **Rate limiting**: Protección contra abuso (100 req/15min)
- 🔍 **Monitoring**: Endpoints de salud y estadísticas

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/YonierGM/Hugginface-proxy
cd proxy-hf-openai

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu token de HF
```

## ⚙️ Configuración

Crear archivo `.env`:

```env
HF_TOKEN=hf_tu_token_aqui
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct:fireworks-ai
PORT=3000
```

## 🎮 Uso

### Iniciar servidor

```bash
npm start
```

### Petición básica

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3.1-8B-Instruct:fireworks-ai",
    "messages": [
      {"role": "user", "content": "Hola, ¿cómo estás?"}
    ]
  }'
```

### Con streaming

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-70b",
    "messages": [{"role": "user", "content": "Explica la IA"}],
    "stream": true
  }'
```

## 🤖 Modelos disponibles

| Alias           | Modelo completo                                     |
| --------------- | --------------------------------------------------- |
| `llama-3.1-8b`  | `meta-llama/Llama-3.1-8B-Instruct:fireworks-ai`     |
| `llama-3.1-70b` | `meta-llama/Llama-3.1-70B-Instruct:fireworks-ai`    |
| `mixtral-8x7b`  | `mistralai/Mixtral-8x7B-Instruct-v0.1:fireworks-ai` |
| `qwen-2.5-72b`  | `Qwen/Qwen2.5-72B-Instruct:fireworks-ai`            |
| `hermes-3`      | `NousResearch/Hermes-3-Llama-3.1-8B:fireworks-ai`   |

Ver todos: `GET /v1/models`

## 🔧 Integración con n8n

1. Crear nodo **AI Agent**
2. Configurar:
   - **Provider**: OpenAI
   - **Base URL**: `http://localhost:3000`
   - **API Key**: Tu token de Hugging Face
   - **Model**: `llama-3.1-8b` (o cualquier alias)

## 📊 Endpoints

| Endpoint               | Método | Descripción                        |
| ---------------------- | ------ | ---------------------------------- |
| `/v1/chat/completions` | POST   | Chat principal (compatible OpenAI) |
| `/v1/models`           | GET    | Lista de modelos disponibles       |
| `/health`              | GET    | Estado del servidor                |
| `/stats`               | GET    | Estadísticas del proxy             |

## 🔍 Monitoreo

```bash
# Verificar salud
curl http://localhost:3000/health

# Ver estadísticas
curl http://localhost:3000/stats

# Logs en tiempo real
tail -f combined.log
```

## 🤝 Casos de uso

- ✅ **n8n workflows** con modelos de HF
- ✅ **LangChain** apps usando HF models
- ✅ **Aplicaciones personalizadas** que esperan OpenAI API
- ✅ **Chatbots** con modelos open source
- ✅ **Prototipado rápido** sin costos de OpenAI

## 📝 Licencia

MIT

## 🆘 Soporte

Si tienes problemas:

1. Revisa logs: `tail -f error.log`
2. Verifica configuración: `GET /health`
3. Consulta modelos: `GET /v1/models`

---

**⭐ Si te fue útil, dale una estrella al repo!**
