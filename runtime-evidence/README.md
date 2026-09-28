# Runtime evidence

This directory stores non-secret evidence that Hackathon demos used the required runtime.

Do not commit API keys, authorization headers, prompt contents containing private data, or raw secrets.

Expected record shape:

```json
{
  "provider": "nebius-token-factory",
  "model": "MODEL_ID",
  "timestamp": "ISO-8601",
  "request_id": "provider-request-id",
  "latency_ms": 0,
  "input_state_hash": "sha256:...",
  "output_action_hash": "sha256:..."
}
```

The exact API path and model identifier must be taken from the official Nebius configuration used at submission time rather than hard-coded into the core simulator.
