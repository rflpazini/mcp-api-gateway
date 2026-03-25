# mcp/api-gateway

[![Build](https://github.com/rflpazini/mcp-api-gateway/actions/workflows/build.yml/badge.svg)](https://github.com/rflpazini/mcp-api-gateway/actions/workflows/build.yml)

A universal MCP (Model Context Protocol) server to integrate any API with Claude Desktop using only Docker configurations.

## Quick Installation

### 1. Using Docker Hub (Recommended)

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

### 2. Local Build

```bash
# Clone the repository
git clone https://github.com/rflpazini/mcp-api-gateway
cd mcp-api-gateway

# Build the image
docker build -t mcp-api-gateway .

# Local test
docker run --rm -it \
  -e API_1_NAME=test \
  -e API_1_SWAGGER_URL=https://petstore.swagger.io/v2/swagger.json \
  -e API_1_BASE_URL=https://petstore.swagger.io/v2 \
  mcp-api-gateway
```

## API Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `API_N_NAME` | Unique API name | Yes |
| `API_N_SWAGGER_URL` | Swagger/OpenAPI file URL | Yes |
| `API_N_BASE_URL` | API base URL (overrides Swagger) | No |
| `API_N_HEADER_*` | Custom headers | No |
| `API_N_HEADERS` | JSON with multiple headers | No |

### Configuration Examples

#### Simple API with Authentication
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
        "mcp-api-gateway:latest"
      ]
    }
  }
}
```

#### Multiple APIs

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
        "mcp-api-gateway:latest"
      ]
    }
  }
}
```

## Using in Claude

### Available Commands

1. **View available APIs**
   - "What APIs are configured?"
   - "Show me the available endpoints"

2. **Explore endpoints**
   - "How do I create a user?"
   - "What parameters do I need to search for products?"

3. **Execute operations**
   - "Create a user named John with email john@email.com"
   - "List all orders from today"
   - "Update product ID 123 with new price $99.90"

### Conversation Examples

**You**: "Create a new customer named Mary Smith"

**Claude**: "I'll create the customer for you. Using the customers API..."
```json
{
  "id": "12345",
  "name": "Mary Smith",
  "createdAt": "2024-01-15T10:30:00Z"
}
```
"Customer Mary Smith created successfully! ID: 12345"

## Publishing to Docker Hub

```bash
# Build for multiple architectures
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-username/mcp-api-gateway:latest \
  -t your-username/mcp-api-gateway:1.0.0 \
  --push .
```

## Use Cases

### 1. Internal Company API
```json
"-e", "API_1_NAME=erp",
"-e", "API_1_SWAGGER_URL=https://erp.company.local/api/swagger.json",
"-e", "API_1_BASE_URL=https://erp.company.local/api",
"-e", "API_1_HEADER_X_COMPANY_ID=company123",
"-e", "API_1_HEADER_AUTHORIZATION=Bearer internal_token"
```

### 2. API with Local Swagger

Mount a local Swagger file into the container:

```json
"-v", "/path/to/swagger.yaml:/swagger.yaml",
"-e", "API_1_NAME=local-api",
"-e", "API_1_SWAGGER_URL=file:///swagger.yaml",
"-e", "API_1_BASE_URL=http://localhost:3000"
```

### 3. GraphQL API (via REST wrapper)
```json
"-e", "API_1_NAME=graphql",
"-e", "API_1_SWAGGER_URL=https://api.example.com/graphql-swagger.json",
"-e", "API_1_BASE_URL=https://api.example.com/graphql"
```

## Security

### Best Practices

1. **Never commit tokens**: Use environment variables or secrets
2. **Use limited scope tokens**: Only necessary permissions
3. **Rotate tokens regularly**: Update your tokens periodically
4. **Always use HTTPS**: Ensure your APIs use HTTPS

### Example with Docker Secrets
```bash
# Create the secret
echo "your_token_here" | docker secret create api_token -

# Use in claude_desktop_config.json
"args": [
  "run", "--rm", "-i",
  "-e", "API_1_HEADER_AUTHORIZATION=Bearer $(cat /run/secrets/api_token)",
  "--secret", "api_token",
  "mcp-api-gateway:latest"
]
```

## Troubleshooting

### API not showing up
- Check if the Swagger URL is accessible
- Confirm environment variables are correct
- Check logs: `docker logs <container_id>`

### Authentication error
- Verify token is correct
- Confirm header format (Bearer, Basic, etc)
- Test the API directly first

### Slow performance
- Use `--pull always` only the first time
- Consider caching the image locally
- Check API latency

## Contributing

PRs are welcome! Some ideas:

- [ ] OAuth authentication support
- [ ] Smart response caching
- [ ] WebSocket support
- [ ] Web configuration interface
- [ ] Metrics and observability

## License

MIT License - see [LICENSE](https://rflpazini.mit-license.org/) file for details.
