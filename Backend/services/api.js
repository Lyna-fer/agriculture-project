const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function runSamplingPipeline({ polygonPoints, cropType, samplingMode }) {
  const response = await fetch(`${API_BASE}/api/sampling/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygonPoints, cropType, samplingMode }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Sampling pipeline failed');
  }

  return response.json(); // Returns exact same shape as old JS version
}