# mcp/api-gateway

[![Build](https://github.com/rflpazini/mcp-api-gateway/actions/workflows/build.yml/badge.svg)](https://github.com/rflpazini/mcp-api-gateway/actions/workflows/build.yml)
[![Docker MCP Toolkit](https://img.shields.io/badge/Docker%20MCP-Toolkit-blue?logo=docker)](https://hub.docker.com/mcp/server/mcp-api-gateway/overview)

A universal MCP (Model Context Protocol) server to integrate any API with Claude Desktop using only Docker configurations. Point it at any Swagger/OpenAPI spec and it automatically generates tools that Claude can use.

Available on the [Docker MCP Toolkit](https://hub.docker.com/mcp/server/mcp-api-gateway/overview).

## Quick Installation

### Using Docker MCP Toolkit (Recommended)

The easiest way to get started is through the [Docker MCP Toolkit](https://hub.docker.com/mcp/server/mcp-api-gateway/overview), which provides one-click setup with Docker Desktop.

### Using Docker Hub

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i", "--pull", "always",
        "-e", "API_1_NAME=my-api",
        "-e", "API_1_SWAGGER_URL=https://api.example.com/swagger.json",
        "-e", "API_1_BASE_URL=https://api.example.com/v1",
        "-e", "API_1_HEADER_AUTHORIZATION=Bearer YOUR_TOKEN",
        "rflpazini/mcp-api-gateway:latest"
      ]
    }
  }
}
```

### Using npx

```bash
API_1_NAME=my-api \
API_1_SWAGGER_URL=https://api.example.com/swagger.json \
API_1_BASE_URL=https://api.example.com/v1 \
npx mcp-api-gateway
```

### Local Build

```bash
git clone https://github.com/rflpazini/mcp-api-gateway
cd mcp-api-gateway
docker build -t mcp-api-gateway .

docker run --rm -it \
  -e API_1_NAME=test \
  -e API_1_SWAGGER_URL=https://petstore.swagger.io/v2/swagger.json \
  -e API_1_BASE_URL=https://petstore.swagger.io/v2 \
  mcp-api-gateway
```

## Configuration

### Core Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `API_N_NAME` | Unique API name | Yes | — |
| `API_N_SWAGGER_URL` | Swagger/OpenAPI spec URL | Yes | — |
| `API_N_BASE_URL` | API base URL (overrides spec) | No | From spec |
| `API_N_HEADER_*` | Custom headers (e.g., `API_1_HEADER_AUTHORIZATION`) | No | — |
| `API_N_HEADERS` | JSON object with multiple headers | No | — |

### Performance Tuning

For large APIs with hundreds of endpoints, these variables reduce the tool list payload sent to Claude:

| Variable | Description | Default |
|----------|-------------|---------|
| `API_N_TOOL_MODE` | `individual` (one tool per endpoint) or `grouped` (group by resource/tag) | `individual` |
| `API_N_SCHEMA_MODE` | `full` (complete schemas) or `compact` (strips large enums, moves optional params to descriptions) | `full` |
| `API_N_PATH_PREFIX` | Comma-separated path prefixes to include (e.g., `/api/v3/users,/api/v3/orders`) | All paths |
| `API_N_TAGS` | Comma-separated OpenAPI tags to include (e.g., `Users,Orders`) | All tags |
| `API_N_EXCLUDE_PARAMS` | Comma-separated parameter names to strip from schemas (e.g., `_clientRegion,_platform`) | None |

### Reliability

| Variable | Description | Default |
|----------|-------------|---------|
| `API_N_TIMEOUT` | Request timeout in milliseconds | `30000` |
| `API_N_MAX_RETRIES` | Max retry attempts for 429/5xx errors (exponential backoff) | `3` |
| `MAX_RESPONSE_SIZE` | Max response size in bytes before truncation | `102400` |

### Performance Results

Tested with a 925-endpoint enterprise API:

| Configuration | Tools | Payload | Reduction |
|---------------|-------|---------|-----------|
| No optimization | 1093 | 2,269 KB | — |
| `SCHEMA_MODE=compact` | 1093 | 633 KB | 72% |
| `TOOL_MODE=grouped` | 53 | 184 KB | 92% |
| `PATH_PREFIX` + `compact` | 94 | 50 KB | 98% |

**Recommendation:** Use `API_N_TOOL_MODE=grouped` for any API with more than 50 endpoints.

## Examples

### Simple API with Authentication

```json
{
  "mcpServers": {
    "github-api": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "API_1_NAME=github",
        "-e", "API_1_SWAGGER_URL=https://api.github.com/swagger.json",
        "-e", "API_1_HEADER_AUTHORIZATION=token ghp_xxxxxxxxxxxx",
        "rflpazini/mcp-api-gateway:latest"
      ]
    }
  }
}
```

### Large API with Grouped Tools

```json
{
  "mcpServers": {
    "enterprise-api": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "API_1_NAME=myapi",
        "-e", "API_1_SWAGGER_URL=https://api.company.com/v3/api-docs",
        "-e", "API_1_BASE_URL=https://api.company.com",
        "-e", "API_1_TOOL_MODE=grouped",
        "-e", "API_1_SCHEMA_MODE=compact",
        "-e", "API_1_HEADER_AUTHORIZATION=Bearer your_token",
        "rflpazini/mcp-api-gateway:latest"
      ]
    }
  }
}
```

### Multiple APIs

Configure multiple APIs by incrementing the index (`API_1_*`, `API_2_*`, `API_3_*`):

```json
{
  "mcpServers": {
    "company-apis": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "API_1_NAME=users",
        "-e", "API_1_SWAGGER_URL=https://api.company.com/users/swagger.json",
        "-e", "API_1_HEADER_X_API_KEY=users_key_123",
        "-e", "API_2_NAME=products",
        "-e", "API_2_SWAGGER_URL=https://api.company.com/products/openapi.yaml",
        "-e", "API_2_HEADER_AUTHORIZATION=Bearer products_token",
        "-e", "API_3_NAME=orders",
        "-e", "API_3_SWAGGER_URL=https://api.company.com/orders/spec.json",
        "-e", "API_3_HEADERS={\"Authorization\":\"Bearer token\",\"X-Tenant\":\"company123\"}",
        "rflpazini/mcp-api-gateway:latest"
      ]
    }
  }
}
```

### Filtered Endpoints

Only load specific parts of a large API:

```json
{
  "mcpServers": {
    "filtered-api": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "API_1_NAME=myapi",
        "-e", "API_1_SWAGGER_URL=https://api.company.com/swagger.json",
        "-e", "API_1_PATH_PREFIX=/api/v3/users,/api/v3/orders",
        "-e", "API_1_SCHEMA_MODE=compact",
        "-e", "API_1_EXCLUDE_PARAMS=_clientRegion,_platform",
        "rflpazini/mcp-api-gateway:latest"
      ]
    }
  }
}
```

### Local Swagger File

Mount a local Swagger file into the container:

```json
{
  "mcpServers": {
    "local-api": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-v", "/path/to/swagger.yaml:/swagger.yaml",
        "-e", "API_1_NAME=local-api",
        "-e", "API_1_SWAGGER_URL=file:///swagger.yaml",
        "-e", "API_1_BASE_URL=http://host.docker.internal:3000",
        "rflpazini/mcp-api-gateway:latest"
      ]
    }
  }
}
```

## Features

### Cookie-Based Authentication

The server automatically persists cookies across requests. When an API returns `Set-Cookie` headers (e.g., after a login call), those cookies are stored and replayed on subsequent requests to the same API. No configuration needed.

### Grouped Tools

When `API_N_TOOL_MODE=grouped` is set, endpoints are automatically grouped into resource tools:

- **Tagged APIs**: Groups by OpenAPI tag (e.g., all `/users` endpoints become one `myapi_Users` tool)
- **Untagged APIs**: Infers groups from path structure (e.g., `/pets`, `/store`)
- Each grouped tool lists available operations in its description, and the LLM selects which one to call via an `operation` parameter

### Health Check

A built-in `check_api_health` tool lets Claude verify API connectivity. It pings each configured API's base URL and reports reachability, HTTP status, and response time.

### Retry with Backoff

Failed requests (429, 500, 502, 503, 504) are automatically retried with exponential backoff. The server honors `Retry-After` headers from rate-limited APIs.

## Using in Claude

### Available Commands

1. **View available APIs**: "What APIs are configured?"
2. **Explore endpoints**: "How do I create a user?" / "What parameters do I need?"
3. **Execute operations**: "Create a user named John with email john@email.com"
4. **Check health**: "Is the API reachable?"

## Security

### Best Practices

1. **Never commit tokens**: Use environment variables or secrets
2. **Use limited scope tokens**: Only necessary permissions
3. **Rotate tokens regularly**: Update your tokens periodically
4. **Always use HTTPS**: Ensure your APIs use HTTPS

### Docker Image Security

The production image uses [Google Distroless](https://github.com/GoogleContainerTools/distroless) as the runtime base:

- No shell, no package manager, no OS utilities
- Runs as non-root user
- 0 known vulnerabilities
- Node.js 24 LTS (supported until April 2028)

## Troubleshooting

### API not showing up
- Check if the Swagger URL is accessible from the container
- Confirm environment variables are correct (especially `API_N_SWAGGER_URL`)
- Check logs: `docker logs <container_id>`

### Authentication error
- Verify token is correct
- Confirm header format (Bearer, Basic, etc)
- For cookie-based auth: ensure the login endpoint is called first

### Too many tools / slow startup
- Use `API_N_TOOL_MODE=grouped` to reduce tool count
- Use `API_N_PATH_PREFIX` or `API_N_TAGS` to filter endpoints
- Use `API_N_SCHEMA_MODE=compact` to reduce schema size

### Request timeouts
- Increase timeout: `API_N_TIMEOUT=60000`
- Check API latency directly

## Contributing

PRs are welcome! Some ideas:

- [ ] OAuth authentication support
- [ ] Smart response caching
- [ ] WebSocket support
- [ ] Web configuration interface
- [ ] Metrics and observability

## License

MIT License - see [LICENSE](https://rflpazini.mit-license.org/) file for details.
