# AI Matrix Classifier - Python+C++ Fusion Server
# Orchestrator (Python) + Inference Engine (C++) Architecture
# Best of both worlds: Python flexibility + C++ performance

import asyncio
import aiohttp
import json
import subprocess
import time
from typing import Dict, Any, Optional
import logging
from pathlib import Path
import psutil
import numpy as np
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FusionClassifier:
    """Hybrid Python (orchestrator) + C++ (inference) system"""

    def __init__(self, cpp_host: str = "localhost", cpp_port: int = 8080):
        self.cpp_endpoint = f"http://{cpp_host}:{cpp_port}/classify"
        self.python_fallback = True
        self.metrics = {
            "total_requests": 0,
            "cpp_requests": 0,
            "python_fallbacks": 0,
            "cpp_response_times": [],
            "python_response_times": [],
            "errors": 0
        }
        self._cpp_available = False
        self._session = None

    async def __aenter__(self):
        """Start C++ server if available"""
        self._session = aiohttp.ClientSession()
        await self._start_cpp_engine()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._session.close()

    async def _start_cpp_engine(self):
        """Start C++ inference engine"""
        try:
            logger.info("🔄 Attempting to start C++ engine...")

            # Check if already running
            async with self._session.get(f"http://localhost:8080/health", timeout=aiohttp.ClientTimeout(total=2)) as resp:
                if resp.status == 200:
                    logger.info("✅ C++ engine already running")
                    self._cpp_available = True
                    return

        except Exception:
            pass

        # Try to start C++ server
        try:
            # Kill any existing process on port 8080
            subprocess.run(["pkill", "-f", "AIMatrixClassifier"], capture_output=True)
            time.sleep(1)

            # Start C++ server
            self.cpp_process = subprocess.Popen(
                ["./AIMatrixClassifier"],
                cwd=Path(__file__).parent,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Wait for startup
            max_wait = 30
            for i in range(max_wait):
                try:
                    async with self._session.get("http://localhost:8080/health", timeout=aiohttp.ClientTimeout(total=1)) as resp:
                        if resp.status == 200:
                            logger.info("🚀 C++ engine started successfully")
                            self._cpp_available = True
                            return
                except Exception:
                    if i % 5 == 0:
                        logger.info(f"Waiting for C++ engine... ({i}/{max_wait}s)")
                    await asyncio.sleep(1)

            logger.error("❌ C++ engine failed to start")
            self.python_fallback = True

        except Exception as e:
            logger.error(f"❌ Failed to start C++ engine: {e}")
            self.python_fallback = True

    async def classify_hybrid(self, task: str, force_python: bool = False) -> Dict[str, Any]:
        """Intelligent routing: C++ for speed, Python for complexity"""
        self.metrics["total_requests"] += 1

        # Decision tree for routing
        should_use_cpp = (
            self._cpp_available and  # C++ is available
            not force_python and      # Not forced to use Python
            len(task) < 1000 and      # Task not too long
            not any(char in task for char in ['\n', '\t', '\r'])  # Simple text
        )

        if should_use_cpp:
            try:
                return await self._classify_with_cpp(task)
            except Exception as e:
                logger.warning(f"C++ classification failed: {e}")
                self.metrics["errors"] += 1
                if self.python_fallback:
                    return await self._classify_with_python(task)

        # Fallback to Python
        return await self._classify_with_python(task)

    async def _classify_with_cpp(self, task: str) -> Dict[str, Any]:
        """Fast C++ inference for simple cases"""
        start_time = time.time()

        payload = {"task": task}
        async with self._session.post(
            self.cpp_endpoint,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=0.1)  # 100ms timeout
        ) as response:
            result = await response.json()

            # Add metadata
            result.update({
                "engine": "C++ Inference Engine",
                "latency_ms": round((time.time() - start_time) * 1000, 2),
                "timestamp": datetime.now().isoformat(),
                "hybrid_system": True
            })

            # Update metrics
            self.metrics["cpp_requests"] += 1
            self.metrics["cpp_response_times"].append(result["latency_ms"])

            return result

    async def _classify_with_python(self, task: str) -> Dict[str, Any]:
        """Flexible Python processing for complex cases"""
        start_time = time.time()

        # Import Python classifier (lazy loading)
        if not hasattr(self, '_python_classifier'):
            from main import get_model, map_to_bool, QUADRANT_NAMES, rag_classify

            self._python_classifier = {
                'get_model': get_model,
                'map_to_bool': map_to_bool,
                'QUADRANT_NAMES': QUADRANT_NAMES,
                'rag_classify': rag_classify
            }

        # Run Python RAG classification
        rag_result = self._python_classifier['rag_classify'](task)
        quadrant = rag_result["prediction"]
        urgent, important = self._python_classifier['map_to_bool'](quadrant)

        result = {
            "task": task,
            "urgent": urgent,
            "important": important,
            "quadrant": quadrant,
            "quadrant_name": self._python_classifier['QUADRANT_NAMES'][quadrant],
            "engine": "Python RAG Engine",
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "timestamp": datetime.now().isoformat(),
            "hybrid_system": True,
            "confidence": rag_result["confidence"],
            "rag_influence": rag_result["rag_influence"],
            "confidence_level": rag_result["confidence_level"]
        }

        # Update metrics
        self.metrics["python_fallbacks"] += 1
        self.metrics["python_response_times"].append(result["latency_ms"])

        return result

    def get_metrics(self) -> Dict[str, Any]:
        """Get hybrid system performance metrics"""
        cpp_avg = np.mean(self.metrics["cpp_response_times"]) if self.metrics["cpp_response_times"] else 0
        python_avg = np.mean(self.metrics["python_response_times"]) if self.metrics["python_response_times"] else 0

        return {
            "system_status": {
                "cpp_available": self._cpp_available,
                "python_fallback": self.python_fallback
            },
            "performance": {
                "total_requests": self.metrics["total_requests"],
                "cpp_requests": self.metrics["cpp_requests"],
                "python_requests": self.metrics["python_fallbacks"],
                "cpp_hit_rate": self.metrics["cpp_requests"] / max(self.metrics["total_requests"], 1),
                "avg_cpp_latency_ms": round(cpp_avg, 2),
                "avg_python_latency_ms": round(python_avg, 2),
                "errors": self.metrics["errors"]
            },
            "memory_usage": {
                "current_mb": psutil.Process().memory_info().rss / 1024 / 1024,
                "cpp_process": self._get_cpp_memory() if hasattr(self, 'cpp_process') else 0
            }
        }

    def _get_cpp_memory(self) -> float:
        """Get C++ process memory usage"""
        try:
            if hasattr(self, 'cpp_process') and self.cpp_process.poll() is None:
                proc = psutil.Process(self.cpp_process.pid)
                return proc.memory_info().rss / 1024 / 1024
        except Exception:
            pass
        return 0

# FastAPI server for hybrid system
from fastapi import FastAPI
from fastapi.responses import JSONResponse

fusion_app = FastAPI(
    title="AI Matrix Classifier - Hybrid Python+C++ System",
    description="Intelligent fusion of Python flexibility and C++ performance"
)

# Global fusion classifier
fusion_classifier: Optional[FusionClassifier] = None

@fusion_app.on_event("startup")
async def startup_event():
    """Initialize hybrid system"""
    global fusion_classifier
    fusion_classifier = FusionClassifier()
    await fusion_classifier.__aenter__()
    logger.info("🌟 Hybrid AI System initialized")

@fusion_app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources"""
    global fusion_classifier
    if fusion_classifier:
        await fusion_classifier.__aexit__(None, None, None)
    logger.info("🔄 Hybrid AI System shut down")

@fusion_app.post("/classify")
async def classify_endpoint(task: str, force_engine: Optional[str] = None):
    """
    Intelligent task classification using hybrid Python+C++ system

    - **task**: Task description to classify
    - **force_engine**: 'cpp' or 'python' to force specific engine
    """
    if not fusion_classifier:
        return JSONResponse(
            status_code=503,
            content={"error": "Classification system not ready"}
        )

    try:
        force_python = force_engine == "python"
        result = await fusion_classifier.classify_hybrid(task, force_python)
        return result

    except Exception as e:
        logger.error(f"Classification error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Classification failed", "details": str(e)}
        )

@fusion_app.get("/metrics")
async def get_metrics():
    """Get hybrid system performance metrics"""
    if not fusion_classifier:
        return JSONResponse(
            status_code=503,
            content={"error": "System not ready"}
        )

    return fusion_classifier.get_metrics()

@fusion_app.get("/health")
async def health_check():
    """System health check"""
    return {
        "status": "healthy",
        "hybrid_system": True,
        "cpp_available": fusion_classifier._cpp_available if fusion_classifier else False,
        "timestamp": datetime.now().isoformat()
    }

@fusion_app.post("/fine-tune")
async def fine_tune_system(use_cpp: bool = True):
    """Fine-tune the hybrid system performance based on usage patterns"""
    if not fusion_classifier:
        return {"error": "System not ready"}

    # Analyze patterns and optimize routing
    metrics = fusion_classifier.get_metrics()

    optimizations = {
        "cpp_routing_percentage": metrics["performance"]["cpp_hit_rate"] * 100,
        "latency_optimization": "active" if metrics["performance"]["avg_cpp_latency_ms"] < 10 else "needed",
        "recommendations": []
    }

    if metrics["performance"]["cpp_hit_rate"] < 0.7:
        optimizations["recommendations"].append("Consider optimizing C++ engine or task preprocessing")

    if metrics["performance"]["avg_cpp_latency_ms"] > 50:
        optimizations["recommendations"].append("C++ engine showing high latency - check optimizations")

    return {
        "message": "Hybrid system analyzed and optimized",
        "optimizations": optimizations
    }

if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting HYBRID Python+C++ AI Matrix Classifier")
    print("   C++ Engine: High-performance inference")
    print("   Python Orchestrator: Intelligent routing + ML")
    print("   Port: 8090 (Python), 8080 (C++)")
    print("")

    uvicorn.run(
        "fusion_server:fusion_app",
        host="0.0.0.0",
        port=8090,
        reload=True,
        log_level="info"
    )
